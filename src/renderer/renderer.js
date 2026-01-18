const { ipcRenderer } = require('electron');

// DOM elements
const submitBtn = document.getElementById('submitBtn');
const promptInput = document.getElementById('prompt');
const imageUpload = document.getElementById('imageUpload');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const responseDiv = document.getElementById('response');
const toggleBtn = document.getElementById('toggleBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const clearBtn = document.getElementById('clearBtn');
const recordBtn = document.getElementById('recordBtn');
const recordText = document.getElementById('recordText');
const micIcon = document.getElementById('micIcon');
const pulseIcon = document.getElementById('pulseIcon');
const recordingStatus = document.getElementById('recordingStatus');

// Make window draggable
let isDragging = false;
let offsetX, offsetY;
const titleBar = document.querySelector('.title-bar');

titleBar.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle')) {
    isDragging = true;
    const winPos = ipcRenderer.sendSync('get-window-position');
    offsetX = e.screenX - winPos.x;
    offsetY = e.screenY - winPos.y;
    e.preventDefault();
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    ipcRenderer.send('move-window', {
      x: e.screenX - offsetX,
      y: e.screenY - offsetY
    });
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// Handle form submission
submitBtn.addEventListener('click', async () => {
  const prompt = promptInput.value;
  const file = imageUpload.files[0];

  if (!prompt && !file) {
    showError('Please enter a question or upload an image');
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  document.getElementById('submitText').textContent = 'Processing...';
  document.getElementById('spinner').classList.remove('hidden');
  showLoadingIndicator();

  try {
    let base64Image = null;
    if (file) {
      try {
        base64Image = await toBase64(file);
      } catch (error) {
        showError('Failed to process the image. Please try another file.');
        return;
      }
    }

    const response = await ipcRenderer.invoke('ask-gemini', {
      prompt,
      image: base64Image
    });

    responseDiv.innerHTML = response;
  } catch (error) {
    handleGeminiError(error);
  } finally {
    resetSubmitButton();
  }
});

// Image preview
imageUpload.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(event) {
      previewImage.src = event.target.result;
      previewImage.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    fileName.textContent = 'No file chosen';
    previewImage.classList.add('hidden');
  }
});

// Handle paste event for images
document.addEventListener('paste', async (event) => {
  const items = (event.clipboardData || window.clipboardData).items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      if (blob) {
        const reader = new FileReader();
        reader.onload = function(event) {
          previewImage.src = event.target.result;
          previewImage.classList.remove('hidden');
        };
        reader.readAsDataURL(blob);

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], 'pasted-image.png', { type: 'image/png' }));
        imageUpload.files = dataTransfer.files;
        fileName.textContent = 'pasted-image.png';
      }
    }
  }
});

// Clear button functionality
clearBtn.addEventListener('click', () => {
  promptInput.value = '';
  imageUpload.value = '';
  fileName.textContent = 'No file chosen';
  previewImage.classList.add('hidden');
  responseDiv.innerHTML = '';
  recordingStatus.classList.add('hidden');
});

// Voice recording functionality
let recognition;
let isRecording = false;

function initializeSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showError('Speech recognition not supported in this browser. Try Chrome or Edge.');
    recordBtn.disabled = true;
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log('Voice recognition started');
    isRecording = true;
    updateRecordingUI(true);
    recordingStatus.textContent = 'Listening... Speak now';
    recordingStatus.classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    promptInput.value = finalTranscript || interimTranscript;
    if (finalTranscript) {
      recordingStatus.textContent = 'Processing your speech...';
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
    showError(`Voice recognition error: ${event.error}`);
  };

  recognition.onend = () => {
    if (isRecording) {
      // If we're still supposed to be recording, restart
      recognition.start();
    }
  };

  return recognition;
}

function startRecording() {
  if (!recognition) {
    recognition = initializeSpeechRecognition();
    if (!recognition) return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    showError('Error starting microphone. Please check permissions.');
    resetRecordingUI();
  }
}

function stopRecording() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }
  isRecording = false;
  resetRecordingUI();
  recordingStatus.textContent = 'Recording stopped';
  setTimeout(() => recordingStatus.classList.add('hidden'), 2000);
}

function updateRecordingUI(recording) {
  if (recording) {
    recordText.textContent = 'Stop Recording';
    recordBtn.classList.remove('bg-red-500');
    recordBtn.classList.add('bg-gray-500');
    micIcon.classList.add('hidden');
    pulseIcon.classList.remove('hidden');
  } else {
    recordText.textContent = 'Record Voice';
    recordBtn.classList.remove('bg-gray-500');
    recordBtn.classList.add('bg-red-500');
    micIcon.classList.remove('hidden');
    pulseIcon.classList.add('hidden');
  }
}

function resetRecordingUI() {
  updateRecordingUI(false);
}

recordBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

// Window controls
toggleBtn.addEventListener('click', () => {
  ipcRenderer.send('toggle-window');
});

minimizeBtn.addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

// Helper functions
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

function showError(message) {
  responseDiv.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">${message}</div>`;
}

function showLoadingIndicator() {
  responseDiv.innerHTML = `
    <div class="text-center py-4">
      <div class="animate-pulse flex flex-col items-center space-y-2">
        <div class="rounded-full bg-blue-200 h-4 w-4"></div>
        <p class="text-sm text-gray-600">Connecting to Gemini...</p>
      </div>
    </div>`;
}

function handleGeminiError(error) {
  console.error('API Error:', error);
  let errorMessage = error.message;
  
  if (errorMessage.includes('network') || errorMessage.includes('offline')) {
    errorMessage = 'Network error. Please check your internet connection.';
  } else if (errorMessage.includes('timeout')) {
    errorMessage = 'Request timed out. The server might be busy.';
  }
  
  showError(`<strong>Error:</strong> ${errorMessage}`);
}

function resetSubmitButton() {
  submitBtn.disabled = false;
  document.getElementById('submitText').textContent = 'Ask Gemini';
  document.getElementById('spinner').classList.add('hidden');
}