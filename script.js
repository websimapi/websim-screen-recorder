document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const videoElement = document.getElementById('preview');
    const cropBtn = document.getElementById('cropBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');
    const resetCropBtn = document.getElementById('resetCropBtn');
    const cropOverlay = document.getElementById('crop-overlay');
    const cropBox = document.getElementById('crop-box');
    const cropCanvas = document.getElementById('cropCanvas');

    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let originalStream;
    let cropActive = false;
    let cropSettings = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    // Cropping functionality
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY;
    let startLeft, startTop, startWidth, startHeight;

    // Initialize drag and resize for crop box
    function initCropBoxControls() {
        cropBox.addEventListener('mousedown', (e) => {
            if (e.target !== cropBox) return; // Skip if clicking on a handle

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = cropBox.offsetLeft;
            startTop = cropBox.offsetTop;

            e.preventDefault();
        });

        document.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeHandle = e.target.className.split(' ')[1]; // Get handle position class
                startX = e.clientX;
                startY = e.clientY;
                startLeft = cropBox.offsetLeft;
                startTop = cropBox.offsetTop;
                startWidth = cropBox.offsetWidth;
                startHeight = cropBox.offsetHeight;

                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // Calculate new position
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;

                // Constrain to video container
                const videoRect = videoElement.getBoundingClientRect();
                const cropRect = cropBox.getBoundingClientRect();
                const containerRect = cropOverlay.getBoundingClientRect();

                newLeft = Math.max(0, Math.min(newLeft, containerRect.width - cropRect.width));
                newTop = Math.max(0, Math.min(newTop, containerRect.height - cropRect.height));

                cropBox.style.left = `${newLeft}px`;
                cropBox.style.top = `${newTop}px`;
            }
            else if (isResizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const containerRect = cropOverlay.getBoundingClientRect();

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                // Resize based on which handle is being dragged
                if (resizeHandle.includes('right')) {
                    newWidth = Math.max(50, Math.min(startWidth + dx, containerRect.width - startLeft));
                }
                if (resizeHandle.includes('bottom')) {
                    newHeight = Math.max(50, Math.min(startHeight + dy, containerRect.height - startTop));
                }
                if (resizeHandle.includes('left')) {
                    const maxLeftMove = startLeft + startWidth - 50;
                    const leftMove = Math.max(0, Math.min(dx, maxLeftMove));
                    newLeft = startLeft + leftMove;
                    newWidth = startWidth - leftMove;
                }
                if (resizeHandle.includes('top')) {
                    const maxTopMove = startTop + startHeight - 50;
                    const topMove = Math.max(0, Math.min(dy, maxTopMove));
                    newTop = startTop + topMove;
                    newHeight = startHeight - topMove;
                }

                cropBox.style.width = `${newWidth}px`;
                cropBox.style.height = `${newHeight}px`;
                cropBox.style.left = `${newLeft}px`;
                cropBox.style.top = `${newTop}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
        });
    }

    // Apply crop to video
    function applyCrop() {
        const videoRect = videoElement.getBoundingClientRect();
        const cropRect = cropBox.getBoundingClientRect();
        const containerRect = cropOverlay.getBoundingClientRect();

        // Calculate crop dimensions relative to the video
        const scaleX = videoElement.videoWidth / videoRect.width;
        const scaleY = videoElement.videoHeight / videoRect.height;

        cropSettings = {
            x: (cropRect.left - videoRect.left) * scaleX,
            y: (cropRect.top - videoRect.top) * scaleY,
            width: cropRect.width * scaleX,
            height: cropRect.height * scaleY
        };

        // Set up crop canvas
        cropCanvas.width = cropSettings.width;
        cropCanvas.height = cropSettings.height;

        cropActive = true;
        cropOverlay.classList.add('hidden');
        applyCropBtn.disabled = true;
        resetCropBtn.disabled = false;

        // If already recording, restart with the cropped stream
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
            startCroppedRecording();
        }
    }

    // Function to create a cropped stream
    function createCroppedStream() {
        const ctx = cropCanvas.getContext('2d');
        const videoRect = videoElement.getBoundingClientRect();

        // Draw the cropped region of the video to the canvas
        function drawVideo() {
            if (cropActive && videoElement.videoWidth) {
                ctx.drawImage(
                    videoElement,
                    cropSettings.x, cropSettings.y, cropSettings.width, cropSettings.height, // Source rectangle
                    0, 0, cropCanvas.width, cropCanvas.height // Destination rectangle
                );
                requestAnimationFrame(drawVideo);
            }
        }

        drawVideo();
        return cropCanvas.captureStream();
    }

    // Function to reset crop
    function resetCrop() {
        cropActive = false;
        cropOverlay.classList.add('hidden');
        resetCropBtn.disabled = true;
        cropBtn.disabled = false;

        // If recording, restart with the original stream
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
            startRecording(originalStream);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    function startCroppedRecording() {
        const croppedStream = createCroppedStream();
        startRecording(croppedStream);
    }

    function startRecording(streamToRecord) {
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(streamToRecord);

        // Handle data available event
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        // Handle recording stopped
        mediaRecorder.onstop = () => {
            downloadBtn.disabled = false;

            // If we have the original stream, stop all tracks
            if (originalStream) {
                originalStream.getTracks().forEach(track => track.stop());
            }

            videoElement.srcObject = null;

            // Show the recorded video for preview
            const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            videoElement.src = URL.createObjectURL(recordedBlob);
            videoElement.controls = true;
        };

        // Start recording
        mediaRecorder.start();
    }

    // Start recording
    startBtn.addEventListener('click', async () => {
        try {
            recordedChunks = [];
            // Request screen sharing
            originalStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'window'
                },
                audio: true  // Attempt to capture audio if available
            });

            stream = originalStream;

            // Display the stream in the video element
            videoElement.srcObject = stream;

            // Update UI
            startBtn.disabled = true;
            stopBtn.disabled = false;
            cropBtn.disabled = false;
            downloadBtn.disabled = true;

            // Start with crop or not
            if (cropActive) {
                startCroppedRecording();
            } else {
                startRecording(stream);
            }

        } catch (error) {
            console.error('Error accessing screen:', error);
            alert('Error accessing screen: ' + error.message);
        }
    });

    // Enable crop
    cropBtn.addEventListener('click', () => {
        cropOverlay.classList.remove('hidden');
        cropBtn.disabled = true;
        applyCropBtn.disabled = false;
    });

    // Apply crop
    applyCropBtn.addEventListener('click', applyCrop);

    // Reset crop
    resetCropBtn.addEventListener('click', resetCrop);

    // Stop recording
    stopBtn.addEventListener('click', () => {
        stopRecording();
        startBtn.disabled = false;
        stopBtn.disabled = true;
        cropBtn.disabled = true;
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
        if (document.visibilityState === 'visible' && originalStream) {
            const tracks = originalStream.getTracks();
            const isActive = tracks.some(track => track.readyState === 'live');

            if (!isActive && mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                startBtn.disabled = false;
                stopBtn.disabled = true;
                cropBtn.disabled = true;
            }
        }
    });

    // Initialize cropping controls
    initCropBoxControls();
});