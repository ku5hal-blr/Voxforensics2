# 🎙️ VoxForensics

**AI-Powered Deepfake Audio Detection & Acoustic Forensic Analysis System**

![VoxForensics](https://img.shields.io/badge/version-3.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.0-3178c6)
![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF)
![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688)
![scikit--learn](https://img.shields.io/badge/scikit--learn-1.9.1-F7931E)
![Firebase](https://img.shields.io/badge/Firebase-v12.19.0-FFCA28)
![Three.js](https://img.shields.io/badge/Three.js-0.186.0-black)

---

## ⚠️ Academic & Demonstration Disclaimer

> [!IMPORTANT]
> **VoxForensics is an academic and exploratory research project developed for educational and demonstration purposes.**
>
> - **Analytical Assistance Only**: The detection verdicts and confidence percentages produced by this system represent machine learning probability estimations based on acoustic feature extraction. They do **not** constitute legally certified forensic evidence or definitive proof of audio authenticity.
> - **No Legal/Regulatory Compliance**: This system does **not** claim formal statutory certification or regulatory compliance with biometric privacy frameworks (e.g., GDPR, BIPA, CCPA).
> - **Multi-Modal Verification Required**: Voice analysis results should always be corroborated by independent multi-modal forensic analysis, contextual metadata, and certified digital forensics specialists before being referenced in sensitive, administrative, or legal contexts.

---

## 🌟 Overview

**VoxForensics** is a dual-tier audio forensics web application engineered to detect synthetic speech, cloned voices, and AI-generated deepfakes. The platform combines a responsive, cyberpunk-inspired React & TypeScript frontend with a containerized Python backend powered by **FastAPI**, **librosa**, and a trained **Random Forest Machine Learning model**.

Users can upload audio files or record voice directly in the browser to analyze **45 acoustic properties**—including Mel-Frequency Cepstral Coefficients (MFCCs), spectral dynamics, energy distribution, and fundamental pitch ($F_0$) statistics. The system delivers classification verdicts, class probabilities, interactive audio visualizations, multi-file batch queuing, persistent scan history, and exportable forensic PDF reports.

---

## ✨ Key Features

- 🤖 **Random Forest ML Classification**: Server-side binary deepfake detection evaluating audio features with a trained scikit-learn Random Forest model (`ml/models/deepfake_detector.joblib`).
- 🔬 **45 Acoustic Features**: Comprehensive acoustic extraction via `librosa` and `soundfile`, capturing MFCCs (1–13 mean & std), spectral centroid, spectral rolloff, spectral bandwidth, spectral flatness, zero-crossing rate, RMS energy, chroma, tempo, and fundamental pitch statistics.
- 📁 **Multi-Format Audio Ingestion**: Supports `.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`, and `.flac` audio formats up to **50 MB** per file. Automated server-side FFmpeg transcoding handles non-standard WebM/M4A containers into PCM WAV before analysis.
- 🎙️ **In-Browser Microphone Recording**: Real-time microphone capture with live visualizer bars and playback preview controls.
- 🛡️ **Browser-Side Security Scanner**: Pre-upload client validation checking file size limits, MIME types, magic byte signatures (WAV `RIFF`, MP3 frame sync, OGG `OggS`, WebM `EBML`), zero-byte files, and executable extension blocking (`.exe`, `.bat`, etc.).
- 📦 **Batch Analysis Queue**: Dedicated batch processing tab supporting sequential multi-file queuing, live progress tracking, error isolation, automatic Firestore history persistence, and per-file PDF report downloads.
- 📄 **Forensic PDF Reports**: Client-side evidentiary PDF generation using `jspdf`, complete with branded headers, classification verdict banners, confidence bars, acoustic metrics breakdown, embedded audio waveforms, and forensic disclaimers.
- 🔐 **Firebase Authentication & Application-Level 2FA**:
  - Secure email and password registration with mandatory email verification.
  - Cryptographically secure 6-digit **Email OTP Two-Factor Authentication (MFA)** with salted SHA-256 hash storage, 5-minute validity, 30-second resend cooldown, and 5-attempt limits.
  - Session-scoped 2FA persistence via `sessionStorage` ensuring authenticated sessions survive browser page refreshes without bypassing security.
  - Password visibility toggle on authentication forms.
- 👑 **Role-Based Access & Dashboards**:
  - **Admin Dashboard**: System metrics, real-time user management via Firestore `onSnapshot`, role switching (user/admin), and secure server-side account deletion via a Google Cloud Function (`deleteUserAccount`) protecting primary admin accounts.
  - **User Dashboard**: Personal scan statistics, deepfake detection count, referral code sharing, and security status.
- 🕒 **Persistent Scan History**: User-isolated Firestore scan history (`users/{userId}/scans/{scanId}`) with local client-side caching and individual/bulk record deletion.
- 🎁 **Referral System**: Unique referral code generation (`VOX-XXXXXX`) tracked across Firestore user profiles.
- 📋 **Session-Scoped Consent Workflow**: Informative consent modal explaining audio data transmission, AI estimation caveats, and user responsibilities before audio processing (admin bypass enabled).
- 🧪 **Automated E2E Pipeline Testing**: Built-in 10-scenario integration test suite verifying API health, feature extraction, response structure, probability bounds, and pipeline repeatability.
- 🌌 **Cyberpunk 3D Interface**: Three.js particle face visualizer, dynamic sine wave audio animations, glassmorphic UI components, and fully responsive layout from mobile (320px) to desktop.

---

## 🏗️ System Architecture

VoxForensics is architected as a decoupled frontend-and-backend system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VoxForensics Frontend                           │
│             React 18 + TypeScript + Vite + TailwindCSS + Three.js      │
│   (Home • Scanner • Batch Processing • History • User/Admin Dashboards)│
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    │ Multipart Audio Upload         │ Auth / Scans / Roles
                    │ (POST /predict)                │ (Firebase Client SDK)
                    ▼                                ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────┐
│             ML Backend API            │  │      Firebase Services      │
│         FastAPI + Python 3.11         │  │                             │
│   (Google Cloud Run: us-central1)     │  │  ├─ Firebase Authentication │
│                                       │  │  │  (Email/Password)        │
│  ├─ FFmpeg Audio Transcoding          │  │  ├─ Cloud Firestore         │
│  ├─ librosa & soundfile               │  │  │  ├─ /users/{userId}      │
│  ├─ 45-Feature Extraction Pipeline    │  │  │  ├─ /users/{uid}/scans   │
│  │  (MFCC, Spectral, Pitch, Energy)   │  │  │  ├─ /email_otp_sessions  │
│  └─ Random Forest Classifier          │  │  │  └─ /mail (Trigger Email)│
│     (ml/models/deepfake_detector.joblib) │  Cloud Functions (v2 HTTPS) │
│                                       │  │  └─ deleteUserAccount       │
└───────────────────────────────────────┘  └─────────────────────────────┘
```

### Data Flow for Audio Analysis

1. **User Input**: The user uploads an audio file (drag-and-drop / file picker) or records audio via the microphone.
2. **Client-Side Security Scan**: `SecurityScanner.tsx` checks file size (up to 50 MB), validates MIME type and extension, verifies magic bytes, and checks for executable extensions or corrupt payloads.
3. **Transmission to ML API**: The audio file is dispatched via `multipart/form-data` to the FastAPI backend (`POST /predict`).
   - *Local Development*: `http://127.0.0.1:8000/predict`
   - *Cloud Production*: `https://voxforensics-ml-220640941248.us-central1.run.app/predict`
4. **Backend Transcoding (if required)**: If the uploaded file is in WebM or M4A container format, `ml/api.py` uses `ffmpeg` to transcode the stream into a clean 16-bit PCM WAV temporary file.
5. **45-Feature Acoustic Extraction (`ml/predict.py`)**: `librosa` decodes the audio, normalizes amplitude, and computes 45 acoustic parameters.
6. **Machine Learning Inference**: Extracted features are assembled into a DataFrame and evaluated by the trained Random Forest model.
7. **Verdict & Probabilities**: The backend computes class probabilities and returns a JSON payload containing the verdict (`Real Voice` vs. `AI-Generated / Fake`), probabilities, and diagnostic feature values.
8. **Frontend Rendering & Persistence**: The React frontend displays verdict badges, probability gauges, and waveform visualizations. If authenticated, the scan is automatically persisted to Firestore under `users/{userId}/scans`.

---

## 🔬 Machine Learning & 45-Feature Acoustic Pipeline

The core ML detection engine uses a **Random Forest Classifier** trained on acoustic properties extracted from audio recordings. The model artifact is stored as a serialized joblib file:

`ml/models/deepfake_detector.joblib`

### Feature Extraction Breakdown (`ml/predict.py`)

The extraction function computes exactly **45 numerical features** from each audio recording:

| Feature Category | Count | Extracted Features & Description |
| :--- | :---: | :--- |
| **MFCCs (1–13 Means)** | 13 | `mfcc_1_mean` through `mfcc_13_mean`: Average spectral envelope across 13 mel-frequency bands. Synthetic voices frequently exhibit unnatural transitions across higher-order coefficients. |
| **MFCCs (1–13 Std Deviations)** | 13 | `mfcc_1_std` through `mfcc_13_std`: Temporal variability of MFCCs. Synthetic audio often shows reduced coefficient variance compared to natural human speech. |
| **Spectral Centroid** | 2 | `spectral_centroid_mean`, `spectral_centroid_std`: The "center of mass" of the audio frequency spectrum, measuring sound brightness and frequency balance. |
| **Spectral Rolloff** | 2 | `spectral_rolloff_mean`, `spectral_rolloff_std`: Frequency below which 85% of total spectral energy lies. Useful for identifying artificial high-frequency acoustic cutoffs. |
| **Spectral Bandwidth** | 2 | `spectral_bandwidth_mean`, `spectral_bandwidth_std`: Spread of frequencies around the centroid, indicating spectral width. |
| **Spectral Flatness** | 2 | `spectral_flatness_mean`, `spectral_flatness_std`: Measure of noise-likeness vs. tone-likeness. Vocoder artifacts and neural vocoder synthesis introduce measurable flatness anomalies. |
| **Zero-Crossing Rate (ZCR)** | 2 | `zero_crossing_rate_mean`, `zero_crossing_rate_std`: Rate of sign-changes in the signal, serving as an indicator of noisiness and fricative balance. |
| **RMS Energy** | 2 | `rms_mean`, `rms_std`: Root Mean Square signal energy, capturing loudness contours and dynamic range across speech frames. |
| **Chroma Features** | 2 | `chroma_mean`, `chroma_std`: Pitch class energy distribution across the 12 chromatic semitones. |
| **Tempo** | 1 | `tempo`: Estimated global rhythm and tempo in beats per minute (BPM) via beat-tracking analysis. |
| **Fundamental Pitch ($F_0$)** | 4 | `pitch_mean`, `pitch_std`, `pitch_min`, `pitch_max`: Extracted using probabilistic YIN (`librosa.pyin`) constrained between 70 Hz and 500 Hz. AI voices often display unnatural pitch stability or robotic pitch jumps. |
| **Total Features** | **45** | **Comprehensive feature vector passed to the Random Forest classifier.** |

### Prediction API Response Structure

The `POST /predict` endpoint returns structured JSON:

```json
{
  "success": true,
  "filename": "sample.wav",
  "verdict": "AI-Generated / Fake",
  "real_probability": 0.1842,
  "fake_probability": 0.8158,
  "features": {
    "rmsEnergy": 0.0421,
    "pitchMean": 182.45,
    "spectralCentroid": 1945.32,
    "zeroCrossingRate": 0.0782
  }
}
```

- **Verdicts**: `Real Voice` (when prediction is class 0) or `AI-Generated / Fake` (when prediction is class 1).
- **Probabilities**: Decimal values between `0.0` and `1.0` representing class likelihoods.

---

## 🔐 Authentication & Security System

VoxForensics implements a multi-step authentication architecture combining Firebase Authentication with custom application-level Two-Factor Authentication (MFA).

```
[ User Registers ]
        │
        ▼
[ Firebase createUserWithEmailAndPassword ]
        │
        ▼
[ Firebase sendEmailVerification ]
        │
        ▼
[ User Verifies Email via Inbox Link ]
        │
        ▼
[ User Signs In with Verified Credentials ]
        │
        ▼
[ 6-Digit Email OTP Dispatched via Trigger Email ]
        │
        ▼
[ User Enters Valid 6-Digit Code ]
        │
        ▼
[ 2FA Token Stored in sessionStorage ] ──► [ Authenticated Session Restored on Refresh ]
```

### Authentication Details

1. **Email & Password Authentication**: Managed by Firebase Authentication client SDK (`firebase/auth`).
2. **Email Verification**: Required for standard user registration before access is granted.
3. **Application-Level Email OTP (2FA)** (`src/services/emailOtp.ts`):
   - **Code Generation**: 6-digit cryptographically random code (`100000`–`999999`) generated using `crypto.getRandomValues`.
   - **Hashed Storage**: Codes are salted and hashed using **SHA-256** via the browser Web Crypto API (`crypto.subtle.digest`). Plaintext codes are **never** stored in Firestore or user documents.
   - **Session Validity**: OTP sessions expire automatically after **5 minutes** (300,000 ms).
   - **Resend Cooldown**: A strict **30-second** cooldown prevents email flood attacks.
   - **Attempt Limits**: Maximum of **5 incorrect verification attempts** before the OTP session is deleted.
   - **Single-Use Consumption**: Upon successful verification, the OTP session document (`/email_otp_sessions/{uid}`) and memory cache are destroyed.
   - **Dispatch Integration**: Verification emails are dispatched via the Firestore `mail` collection (standard Firebase Trigger Email extension format).
4. **Session Persistence & Browser Refresh**:
   - `onAuthStateChanged` listens for Firebase session updates on app load.
   - Verified 2FA state is recorded in `sessionStorage` (`voxforensics_2fa_${uid}`).
   - Valid authenticated sessions **survive browser page refreshes** without forcing 2FA re-entry during the same browser session.
5. **Centralized Logout**:
   - Clears Firebase Auth state (`signOut`).
   - Clears session-scoped 2FA tokens (`clearSession2FA`).
   - Clears session consent state.
   - Resets active navigation tab to `'home'`.
   - Closes dashboard and mobile drawer navigation.
6. **Administrator Privileges & Account Protection**:
   - Pre-configured administrator: `admin@voxforensics.com`.
   - Administrators bypass Email OTP 2FA and consent modal during testing.
   - Primary administrator account cannot be deleted or demoted.

---

## 👥 Demonstration Accounts

For evaluation, academic presentation, and testing purposes, the following administrator credentials are pre-configured in Firebase Authentication:

| Account Type | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@voxforensics.com` | `admin123` | Full access: User management, role modification, server-side account deletion, system metrics, and all forensic tools |

> [!NOTE]
> Standard users register dynamically through the application interface to demonstrate the full registration, email verification, and Email OTP 2FA lifecycle. When testing registration with referral tracking, the administrator referral code `VOX-ADMIN01` can be used.
>
> *(See [LOGIN_CREDENTIALS.md](file:///c:/Users/Administrator/Desktop/vox/Voxforensics2-1/LOGIN_CREDENTIALS.md) for step-by-step evaluation instructions.)*

---

## 🛡️ Pre-Upload Security Scanner (`SecurityScanner.tsx`)

Before any file is dispatched for analysis, the client-side security scanner runs heuristic integrity and safety checks:

- **File Size Checks**: Maximum allowed size is 50 MB; warns when files exceed 25 MB.
- **MIME & Extension Validation**: Validates allowed audio MIME types and extensions (`.wav`, `.mp3`, `.ogg`, `.webm`, `.m4a`, `.aac`, `.flac`).
- **Executable Blocking**: Blocks executable extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.msi`, `.com`, `.scr`, `.ps1`, `.vbs`, `.js`) and executable MIME types.
- **Malware Pattern Detection**: Warns if filenames contain suspicious strings (`virus`, `malware`, `trojan`, `hack`, `exploit`).
- **Magic Byte Signature Verification**: Checks the first 1024 bytes of the file buffer to verify audio container magic bytes:
  - WAV: `RIFF` / `WAVE`
  - MP3: Frame synchronization header (`0xFF 0xE0`)
  - OGG: `OggS` container header
  - WebM: Matroska EBML signature (`0x1A 0x45 0xDF 0xA3`)
- **Zero-Byte & Corruption Detection**: Blocks 0-byte files and flags files smaller than 100 bytes as corrupted.

---

## 📦 Batch Analysis System (`BatchProcessing.tsx`)

VoxForensics provides a dedicated top-level **Batch Processing** tab for bulk audio analysis:

- **Queue Management**: Multi-file drag-and-drop or file picker queuing with instantaneous format and size validation.
- **Sequential Non-Blocking Execution**: Files are analyzed sequentially to prevent server overload and network contention.
- **Live Progress Tracking**: Live status badges (`Waiting`, `Analyzing`, `Completed`, `Failed`), animated progress bars, and execution timers.
- **Error Isolation**: Individual file failures (e.g., corrupted audio or conversion errors) do not interrupt the remaining queue.
- **Automatic History Sync**: Completed analyses are automatically persisted to the authenticated user's Firestore scan history.
- **Per-File PDF Downloads**: Instant PDF forensic report generation for individual completed items directly from the batch table.

---

## 📄 Forensic PDF Reports (`generateAnalysisPDF.ts`)

Evidentiary PDF reports are generated client-side using `jspdf`:

- **Evidentiary Header**: VoxForensics branding, unique report ID, timestamp, and target filename.
- **Verdict Banner**: Visual color-coded banner indicating detection outcome (`REAL VOICE` in emerald vs. `AI-GENERATED` in crimson).
- **Probability Breakdown**: Confidence percentages, real voice probability, and AI voice probability.
- **Embedded Audio Waveform**: Visual audio amplitude profile rendered dynamically into the PDF document.
- **Acoustic Metrics Table**: Summary table of extracted acoustic metrics (Pitch, Energy, Spectral Centroid, ZCR).
- **Evidentiary Disclaimer**: Standard forensic notice clarifying that the report is an automated algorithmic assessment intended to supplement professional investigation.

---

## 🧪 E2E Testing & Pipeline Verification

The application includes an automated **End-to-End Test Panel** (`src/components/E2ETestPanel.tsx` and `src/utils/testSuite.ts`) accessible from the UI to test the operational health of the audio analysis pipeline.

### The 10 Test Scenarios

The suite evaluates 10 integration checkpoints using test audio fixtures in `public/test_audio/`:

1. **Test 1: ML API Health Check**: Verifies HTTP connectivity to `/health` and confirms the ML model is loaded in memory.
2. **Test 2: Real Voice ML Prediction**: Dispatches `/test_audio/test_real.wav` and verifies classification as `Real Voice`.
3. **Test 3: AI Voice ML Prediction**: Dispatches `/test_audio/test_fake.wav` and verifies classification as `AI-Generated`.
4. **Test 4: Prediction Probability Validation**: Asserts that `real_probability` and `fake_probability` fall within `[0.0, 1.0]`.
5. **Test 5: Prediction Response Structure**: Validates schema presence of `success`, `filename`, `verdict`, and probability numbers.
6. **Test 6: ML Feature Extraction**: Confirms acoustic feature metrics are included in the API response.
7. **Test 7: Repeat Real Audio Processing**: Asserts repeatability and determinism across multiple runs with real voice fixtures.
8. **Test 8: Repeat AI Audio Processing**: Asserts repeatability and determinism across multiple runs with synthetic voice fixtures.
9. **Test 9: Frontend → ML API Connection**: Tests network round-trip latency and CORS compatibility.
10. **Test 10: Complete ML Detection Pipeline**: Tests the full end-to-end flow from audio payload to final classified response.

> [!IMPORTANT]
> **Distinction Between Pipeline Pass Rate and ML Model Accuracy**:
> - The **E2E Test Pass Rate** (e.g., 100% / 10 out of 10 tests passed) measures **system integration health**, confirming that endpoints, feature extraction, audio decoders, and data pipelines are functioning without runtime errors.
> - The E2E pass rate is **NOT** the statistical classification accuracy of the machine learning model on arbitrary audio datasets.

---

## ☁️ Deployment Architecture & Cloud Infrastructure

VoxForensics is deployed across Google Cloud Platform and Firebase infrastructure:

### 1. Frontend: Firebase Hosting
- **Production URL**: `https://voxforensics.web.app` (and `https://voxforensics.firebaseapp.com`)
- **Hosting Configuration**: `firebase.json` with single-page application (SPA) rewrites to `/index.html`.
- **Static Assets**: Built with Vite (`npm run build`) targeting `dist/`.

### 2. Backend ML API: Google Cloud Run
- **Service Name**: `voxforensics-ml`
- **Region**: `us-central1`
- **Live Endpoint**: `https://voxforensics-ml-220640941248.us-central1.run.app`
- **Container**: Built from `ml/Dockerfile` using `python:3.11-slim`, installing system dependencies `ffmpeg` and `libsndfile1`.
- **Scaling**: Serverless auto-scaling container responding to `POST /predict` and `GET /health` with managed HTTPS.

### 3. Firebase Cloud Functions
- **Function Name**: `deleteUserAccount`
- **Runtime**: Node.js 20 (Firebase Functions v2 HTTPS callable)
- **Region**: `us-central1`
- **Security**: Verifies caller authentication and admin role in Firestore, prohibits self-deletion, and prevents deletion of `admin@voxforensics.com`. Deletes both the Firebase Auth account and Firestore user document.

### 4. Cloud Firestore
- **Security Rules**: Enforced via `firestore.rules`.
- **Collections**:
  - `/users/{userId}`: User profile, role, referral code, 2FA status.
  - `/users/{userId}/scans/{scanId}`: User-isolated scan history records.
  - `/scans/{scanId}`: Root-level scan queries (restricted to owner or admin).
  - `/email_otp_sessions/{uid}`: Salted SHA-256 hashed OTP verification sessions.
  - `/mail`: Trigger Email extension queue.

---

## ⚡ Performance Considerations & Latency

Analysis latency is dynamic and varies according to several operational factors:

1. **Cloud Run Cold Starts**: When the serverless backend scales down to zero instances, the initial request requires container initialization, Python package loading (`librosa`, `scipy`, `scikit-learn`), and model deserialization. Subsequent requests process significantly faster.
2. **Audio Duration & Sampling**: Longer audio recordings require more memory and processing frames for STFT and chromagram computations.
3. **Format Transcoding**: WebM and M4A uploads require an intermediate server-side FFmpeg subprocess transcoding step to generate 16-bit PCM WAV before feature extraction.
4. **Fundamental Pitch Analysis ($F_0$)**: Estimating pitch contours using `librosa.pyin` is computationally intensive, as it performs probabilistic YIN candidate evaluation frame-by-frame across the 70–500 Hz range.
5. **Network Latency**: File upload speeds depend on user uplink bandwidth to the `us-central1` Cloud Run region.

---

## 🔒 Privacy, Consent & Data Handling

### Audio Transmission Notice
Audio submitted for analysis is transmitted securely via HTTPS to the deployed backend on Google Cloud Run (or localhost in local development) where acoustic features are extracted. Audio is stored in temporary container memory during analysis and discarded after processing.

### User Consent Workflow (`ConsentModal.tsx`)
Standard users are presented with a consent modal prior to performing audio analysis. The consent flow:
- Clarifies that audio is processed by AI estimation models.
- Explains that results are analytical estimations rather than absolute legal proof.
- Details microphone permissions and user responsibilities regarding copyright and authorized consent.
- Records agreement in `sessionStorage` (`voxforensics_consent_${userId}`) for the duration of the browser session.
- Administrators bypass the consent modal for rapid evaluation.

---

## 🛠️ Technology Stack

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend Core** | React 18 (`^18.2.0`), TypeScript (`^5.7.0`), Vite (`^6.3.5`) |
| **Styling & UI** | TailwindCSS v4 (`^4.1.7`), Lucide React (`^0.294.0`), Framer Motion (`^11.16.1`) |
| **3D & Visuals** | Three.js (`^0.186.0`), Web Audio API (AnalyserNode & Canvas 2D) |
| **PDF Reporting** | jsPDF (`^4.2.1`) |
| **Backend API** | FastAPI (`0.141.1`), Uvicorn (`0.53.0`), Python 3.11 |
| **Audio Processing** | librosa (`1.0.0`), soundfile (`0.14.0`), FFmpeg |
| **Machine Learning** | scikit-learn (`1.9.1`), joblib (`1.6.0`), pandas (`3.0.6`), numpy (`2.5.3`), scipy (`1.18.1`) |
| **Cloud & Auth** | Firebase SDK (`^12.19.0`), Firebase Auth, Cloud Firestore, Cloud Functions (Node 20), Google Cloud Run |

---

## 📁 Repository Structure

```
Voxforensics2-1/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx       # System overview, user management & Cloud Function deletion
│   │   ├── AuthSystem.tsx           # Email/password authentication, registration & Email OTP MFA
│   │   ├── BatchProcessing.tsx      # Multi-file batch queue, progress tracking & PDF generation
│   │   ├── ConsentModal.tsx         # User privacy notice & session-scoped consent modal
│   │   ├── E2ETestPanel.tsx         # 10-scenario automated E2E pipeline test UI
│   │   ├── LiveBackground.tsx       # Three.js 3D particle face & sine wave visualizer
│   │   ├── SecurityScanner.tsx      # In-browser file validation & magic byte security scanner
│   │   └── UserDashboard.tsx        # Profile metrics, referral sharing & security settings
│   ├── services/
│   │   ├── emailOtp.ts              # Cryptographic Email OTP generation & SHA-256 salted hashing
│   │   └── history.ts               # User-scoped Firestore scan history & localStorage caching
│   ├── utils/
│   │   ├── analysis.ts              # Acoustic feature types & client-side heuristic types
│   │   ├── generateAnalysisPDF.ts   # Client-side jsPDF generator with embedded waveform
│   │   └── testSuite.ts             # 10 automated integration tests for ML API & pipeline
│   ├── App.tsx                      # Main application controller, tab router & responsive layout
│   ├── firebase.ts                  # Firebase client SDK initialization
│   ├── index.css                    # Design system styles, cyber glow utilities & responsive rules
│   └── main.tsx                     # Application React DOM entry point
├── functions/
│   ├── src/
│   │   └── index.ts                 # deleteUserAccount Cloud Function (Node 20 / v2 HTTPS)
│   ├── package.json                 # Cloud Functions dependencies
│   └── tsconfig.json                # Functions TypeScript configuration
├── ml/
│   ├── models/
│   │   └── deepfake_detector.joblib # Trained Random Forest model artifact
│   ├── .dockerignore                # Docker build ignore rules
│   ├── Dockerfile                   # Cloud Run container configuration (Python 3.11-slim)
│   ├── api.py                       # FastAPI application, /predict & /health endpoints
│   ├── check_features.py            # Feature inspection utility
│   ├── download_dataset.py          # Training dataset download script
│   ├── extract_features.py          # Batch feature extraction script
│   ├── predict.py                   # 45-feature extraction logic & CLI prediction
│   ├── requirements.txt             # Python ML dependencies (FastAPI, librosa, scikit-learn)
│   └── train_model.py               # Random Forest training script
├── public/
│   ├── test_audio/
│   │   ├── test_fake.wav            # Synthetic audio fixture for E2E testing
│   │   └── test_real.wav            # Genuine audio fixture for E2E testing
│   └── background.jpg               # Public static background graphic
├── .env.example                     # Environment variables template
├── .env.production                  # Production Cloud Run ML API URL
├── firebase.json                    # Firebase Hosting, Functions, and Firestore configuration
├── firestore.rules                  # Firestore security rules
├── package.json                     # Frontend npm dependencies and build scripts
├── vite.config.js                   # Vite configuration
└── README.md                        # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: 20+ installed
- **npm**: 9+ installed
- **Python**: 3.10 or 3.11 installed
- **FFmpeg**: Installed and accessible in system PATH (required for audio transcoding)

---

### Step 1: Start the ML Backend API

The Python FastAPI backend extracts 45 acoustic features and executes model inference:

```bash
# Navigate to the project root
cd Voxforensics2-1

# Activate the Python virtual environment (Windows PowerShell)
.\ml\.venv\Scripts\Activate.ps1

# Or create a new venv if not already set up:
# python -m venv ml/.venv
# .\ml\.venv\Scripts\Activate.ps1
# pip install -r ml/requirements.txt

# Start the FastAPI server using Uvicorn
python -m uvicorn ml.api:app --reload --port 8000
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- Health Endpoint: `http://127.0.0.1:8000/health`

---

### Step 2: Start the Frontend Application

In a separate terminal:

```bash
# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

The application will be available at: `http://localhost:3000` (or the port specified by Vite).

---

### Step 3: Run the Automated E2E Pipeline Tests

1. Open the application in your browser.
2. Click **"🧪 Run E2E Tests"** in the top navigation bar or scanner footer.
3. Click **"🚀 Run All 10 Tests"**.
4. The test suite will run all 10 scenarios against the backend and display live diagnostic results.

---

## 📦 Production Build

To compile the frontend for production deployment:

```bash
# Compile TypeScript and bundle static assets
npm run build
```

The output bundle is generated in `dist/` and is ready for deployment to Firebase Hosting via `firebase deploy --only hosting`.

---

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
