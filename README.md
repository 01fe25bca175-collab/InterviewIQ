# AI Interview Coach — NVIDIA AI + Voice + Practice Integrity

A browser-based mock interview coach with separate MCQ practice and one-to-one AI interview modes. It supports local profiles, NVIDIA-hosted LLM calls through a Node.js backend, optional voice input/output, and an opt-in practice-integrity event log.

## Run locally
1. Install a current LTS version of Node.js.
2. Open this folder in VS Code and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add your NVIDIA API key to `NVIDIA_API_KEY` and choose a model available in your NVIDIA account in `NVIDIA_MODEL`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Do not open `index.html` directly: the AI endpoints require the Node.js backend. Never commit `.env` or put the API key in frontend JavaScript.

## Voice interview
- Enable **Voice mode** to have AI interviewer responses read aloud using browser text-to-speech.
- Select **Start speaking** and allow microphone access to transcribe an answer into the answer box.
- Press **Stop microphone**, review the transcription, then press Send.
- **Repeat question** reads the latest interviewer message aloud.
- Speech recognition support depends on the browser and device; Chrome/Edge generally provide the best support. Typing remains available as a fallback.
- Speech recognition is performed by the browser and its implementation may use browser-vendor services. Ask for permission and explain this before recording/transcribing real users.

## Practice-integrity monitor (opt-in)
The user must explicitly enable **Practice integrity monitor**. While the AI interview is active, the app can log browser-observable events such as:
- Interview tab/page becoming hidden (visibility change)
- Browser window losing focus
- Copy or paste events on the interview page
- Exiting fullscreen after the session enters fullscreen, where supported

Use **View event log** to inspect events. The app does not record video, take screenshots, scan other applications, monitor other browser tabs' contents, or prove that a user cheated. Focus loss and tab switches can happen for legitimate reasons, so these events should be treated as review prompts, not automatic penalties. The monitor is opt-in and can be disabled.

## Current limitations
- Profiles and results are saved in browser `localStorage`, not in a shared database and not synced across devices.
- Voice interview is speech-to-text plus text-to-speech, not a real-time audio streaming model.
- MCQ scoring is deterministic; AI-generated questions require a valid NVIDIA key and an available model.
- The integrity monitor is lightweight browser-side deterrence, not enterprise proctoring or validated cheating detection.
- For a public deployment, host the Node.js backend separately from static hosting, configure HTTPS/CORS as appropriate, set environment variables in the hosting provider, and add clear consent/retention/privacy notices.


## Voice interview and optional integrity checks

- Turn on **Voice mode** to have AI interviewer replies read aloud. Use **Start speaking** to transcribe your answer with the browser's SpeechRecognition support (best supported in current Chrome/Edge); you can always type instead. Browser speech recognition availability and privacy behavior vary by browser.
- **Enable monitoring for this session** to log when the interview page becomes hidden, the browser loses focus, copy/paste is attempted on the page, or fullscreen is exited. These signals are not proof of cheating and cannot reveal which other application or tab is being used. A browser page cannot reliably detect whether someone is using an external AI tool.
- **Enable camera face-count check** separately to allow camera access. The browser downloads MediaPipe's face-detection model on first use and estimates how many faces are visible. Frames are processed in the browser and are not sent to the NVIDIA API by this feature. Stop the camera or uncheck consent to turn it off. Camera detection can miss faces or create false detections; it should not be used alone for punitive decisions. Camera access requires permission and a secure context (localhost or HTTPS), plus an internet connection for the model download.
- Ask users for clear consent before enabling camera or activity monitoring. Provide a non-camera alternative where appropriate.
