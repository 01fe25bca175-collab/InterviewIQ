// Optional, consent-based face-count check. Frames are processed in-browser only.
const video = document.getElementById('proctorVideo');
const consent = document.getElementById('cameraConsent');
const statusEl = document.getElementById('cameraStatus');
const faceCountEl = document.getElementById('faceCount');
const overlay = document.getElementById('cameraOverlay');
const preview = document.querySelector('.camera-preview');
const stopBtn = document.getElementById('stopCamera');
let stream = null;
let detector = null;
let timer = null;
let running = false;
let interviewActive = false;
let lastMultiple = false;
let lastCount = -1;

function cameraEvent(type, detail) {
  window.dispatchEvent(new CustomEvent('camera-proctor-event', { detail: { type, detail } }));
}

async function loadDetector() {
  if (detector) return detector;
  statusEl.textContent = 'Loading face detector… first use needs an internet connection.';
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  detector = await vision.FaceDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
    runningMode: 'VIDEO', minDetectionConfidence: 0.55
  });
  return detector;
}

async function startCamera() {
  if (running || !consent.checked) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    statusEl.textContent = 'Camera access requires a supported browser and HTTPS or localhost.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    await loadDetector();
    running = true;
    preview.classList.add('active');
    overlay.textContent = 'Face check active';
    stopBtn.disabled = false;
    statusEl.textContent = 'Camera active. Face count is an estimate; lighting and camera angle affect accuracy.';
    timer = window.setInterval(scanFrame, 650);
  } catch (error) {
    stopCamera(false);
    statusEl.textContent = `Camera could not start: ${error.message || 'permission denied'}. Check browser permission and internet access.`;
  }
}

function scanFrame() {
  if (!running || !interviewActive || !video.videoWidth || !detector) return;
  try {
    const result = detector.detectForVideo(video, performance.now());
    const count = (result.detections || []).filter(d => (d.categories?.[0]?.score ?? 0) >= 0.55).length;
    if (count !== lastCount) {
      faceCountEl.textContent = `Faces detected: ${count}`;
      lastCount = count;
    }
    const multiple = count > 1;
    if (multiple && !lastMultiple) cameraEvent('Multiple faces detected', `The camera model detected ${count} faces in frame. This may be a false detection.`);
    lastMultiple = multiple;
  } catch (_) {
    statusEl.textContent = 'Face detection paused due to a camera processing issue.';
  }
}

function stopCamera(uncheck = true) {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  preview.classList.remove('active');
  overlay.textContent = 'Camera off';
  faceCountEl.textContent = 'Faces detected: —';
  stopBtn.disabled = true;
  lastMultiple = false;
  lastCount = -1;
  if (uncheck) consent.checked = false;
  statusEl.textContent = 'Camera check is off. No video is saved by this feature.';
}

consent.addEventListener('change', () => {
  if (consent.checked) {
    if (interviewActive) startCamera();
    else statusEl.textContent = 'Camera consent saved for this page. Start the interview to activate the camera.';
  } else stopCamera(false);
});
stopBtn.addEventListener('click', () => stopCamera(true));
window.addEventListener('interview-state', event => {
  interviewActive = Boolean(event.detail?.active);
  if (interviewActive && consent.checked) startCamera();
  if (!interviewActive) stopCamera(false);
});
window.addEventListener('beforeunload', () => stopCamera(false));
