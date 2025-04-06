document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const videoElement = document.getElementById('preview');
    
    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    
    // Start recording
    startBtn.addEventListener('click', async () => {
        try {
            // Request screen sharing
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'window'
                },
                audio: true  // Attempt to capture audio if available
            });
            
            // Display the stream in the video element
            videoElement.srcObject = stream;
            
            // Create MediaRecorder
            mediaRecorder = new MediaRecorder(stream);
            
            // Handle data available event
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            
            // Handle recording stopped
            mediaRecorder.onstop = () => {
                downloadBtn.disabled = false;
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
                
                // Show the recorded video for preview
                const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
                videoElement.src = URL.createObjectURL(recordedBlob);
                videoElement.controls = true;
            };
            
            // Start recording
            mediaRecorder.start();
            
            // Update UI
            startBtn.disabled = true;
            stopBtn.disabled = false;
            downloadBtn.disabled = true;
            
        } catch (error) {
            console.error('Error accessing screen:', error);
            alert('Error accessing screen: ' + error.message);
        }
    });
    
    // Stop recording
    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });
    
    // Download recorded video
    downloadBtn.addEventListener('click', () => {
        if (recordedChunks.length === 0) {
            alert('No recording available to download.');
            return;
        }
        
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `screen-recording-${timestamp}.webm`;
        a.href = url;
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
    });
    
    // Handle when the user stops sharing manually through the browser UI
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && stream) {
            const tracks = stream.getTracks();
            const isActive = tracks.some(track => track.readyState === 'live');
            
            if (!isActive && mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
    });
});

