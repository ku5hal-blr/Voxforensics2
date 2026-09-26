# 🎙️ VoxForensics

**AI-Powered Deepfake Audio Detection & Forensic Analysis System**

![VoxForensics](https://img.shields.io/badge/version-3.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.3.1-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688)
![Firebase](https://img.shields.io/badge/Firebase-v10-FFCA28)
![Three.js](https://img.shields.io/badge/Three.js-0.175-black)

---

## 🌟 Overview

**VoxForensics** is a comprehensive, production-ready audio forensic system engineered to detect synthetic and AI-generated voices (deepfakes). Combining a modern React & TypeScript interface with a trained **Random Forest Machine Learning backend** and **Firebase Cloud Infrastructure**, VoxForensics delivers forensic verification, real-time audio visualization, batch processing, and evidentiary PDF reporting.

---

## ✨ Key Features

- 🤖 **Random Forest ML Detection**: High-accuracy deepfake detection powered by a trained Random Forest model (`ml/models/deepfake_detector.joblib`) and FastAPI backend (`ml/api.py`).
- 🔬 **45 Acoustic Features**: Comprehensive feature extraction including MFCCs (1–13 mean & std), spectral centroid, spectral rolloff, spectral bandwidth, spectral flatness, zero-crossing rate, RMS energy, chroma, tempo, and fundamental pitch statistics.
- 🎙️ **Microphone Recording**: Direct in-browser microphone recording with real-time waveform visualizer bars and simulated fallback.
- 📁 **Audio Upload Support**: Drag-and-drop or file picker upload supporting WAV, MP3, OGG, FLAC, and M4A up to 50 MB.
- 📦 **Batch Processing**: Dedicated top-level tab for queuing multiple audio files with sequential non-blocking analysis, live progress tracking, and per-file PDF downloads.
- 📄 **Forensic PDF Reports**: Client-side PDF generation using jsPDF featuring branded headers, verdict banners, confidence bars, acoustic tables, evidentiary disclaimers, and **embedded audio waveforms**.
- 📱 **Mobile-Responsive UI**: Fully responsive interface supporting viewports from 320px–430px mobile up to desktop, featuring a mobile slide-down hamburger drawer, non-wrapping action controls, and horizontal-scroll data tables.
- 🔐 **Firebase Authentication & MFA**:
  - Email and password authentication with email verification.
  - Application-level **Email OTP Two-Factor Authentication (MFA)** with cryptographically secure random codes, SHA-256 salted hashing, 10-minute expiry, 60-second resend cooldown, and 5-attempt limits.
  - Show/Hide Password eye toggle on authentication forms.
- 👑 **Role-Based Access & Dashboards**:
  - **Admin Dashboard**: System analytics, registered user management, role toggles, and secure account deletion.
  - **User Dashboard**: Personal scan statistics, referral code sharing, security status, and scan history.
- 🛡️ **Secure Cloud Functions**: Dedicated callable Firebase Cloud Function (`deleteUserAccount` in `us-central1`) using Firebase Admin SDK with server-side admin verification, self-deletion prevention, and primary admin account protection (`admin@voxforensics.com`).
- 🕒 **Scan History**: Full persistent history tracking in Firestore with local caching and individual/bulk deletion.
- 🎁 **Referral Program**: Unique referral codes (`VOX-XXXXXX`) tracked across user profiles.
- 📋 **Legal Consent System**: Simplified GDPR/BIPA compliant agreement modal with single-checkbox confirmation and expandable policy sections (sessionStorage per-user lifecycle; admin bypass).
- 🌌 **Cyberpunk 3D Visuals**: Three.js particle face silhouette, glowing sine wave visualizers, and glassmorphic UI components.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VoxForensics Frontend                        │
│             React 18 + TypeScript + Vite + Three.js             │
│   (Home • Scanner • Batch • History • User/Admin Dash • Mobile) │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ (Audio Payload / multipart)      │ (Auth / Scans / Roles)
               ▼                                  ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│       ML Backend API          │  │       Firebase Backend       │
│     FastAPI + Python 3.10+    │  │  Firebase Auth (Email/Pass)  │
│  Endpoint: POST /predict      │  │  Firestore Database          │
│  ├─ librosa & soundfile       │  │  ├─ /users                   │
│  ├─ 45 Acoustic Features      │  │  ├─ /scans                   │
│  └─ Random Forest Classifier  │  │  ├─ /email_otp_sessions      │
│     (deepfake_detector.joblib)│  │  └─ /mail (Trigger Email)    │
│  Deployed on Google Cloud Run │  │  Cloud Functions             │
│  or local :8000 via Vite env  │  │  └─ deleteUserAccount        │
└───────────────────────────────┘  └──────────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: 20+ installed
- **npm**: 9+ installed
- **Python**: 3.10+ with `venv`
- **FFmpeg**: Installed and accessible in system PATH (required for audio conversion)

---

### Step 1: Start the Machine Learning Backend

The ML API runs on FastAPI and handles feature extraction and Random Forest model inference.

```bash
# Navigate to the project root
cd Voxforensics2-1

# Activate the existing virtual environment (Windows PowerShell)
.\ml\.venv\Scripts\Activate.ps1

# Start the FastAPI server using Uvicorn
python -m uvicorn ml.api:app --reload --port 8000
```

The API will be available at: `http://127.0.0.1:8000`  
Interactive Swagger docs: `http://127.0.0.1:8000/docs`

---

### Step 2: Start the Frontend Application

In a separate terminal window:

```bash
# Install frontend dependencies (if not already installed)
npm install

# Start the Vite development server
npm run dev
```

The application will be accessible at: `http://localhost:3000`

---

### Step 3: Firebase Cloud Functions (Optional / Maintenance)

The Cloud Functions package is configured in `functions/`:

```bash
cd functions
npm install
npm run build
```

---

## 👥 Demonstration Accounts

For academic, demonstration, and evaluation purposes, the following pre-configured Firebase Authentication credentials are available:

| Account Type | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@voxforensics.com` | `admin123` | Full access: User management, Cloud Function deletions, system analytics |
| **Standard User** | `user@example.com` | `user123` | User access: Audio scanning, Batch processing, History, Referral program |

*(See [LOGIN_CREDENTIALS.md](file:///c:/Users/Administrator/Desktop/vox/Voxforensics2-1/LOGIN_CREDENTIALS.md) for full testing instructions.)*

---

## 📁 Repository Structure

```
Voxforensics2-1/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx       # Administrator user management & analytics
│   │   ├── AuthSystem.tsx           # Authentication, registration & Email OTP MFA
│   │   ├── BatchProcessing.tsx      # Multi-file batch queue & PDF generation
│   │   ├── ConsentModal.tsx         # Legal biometric & GDPR consent modal
│   │   ├── LiveBackground.tsx       # 3D Three.js particle face & wave background
│   │   └── UserDashboard.tsx        # Profile stats, referrals & security settings
│   ├── services/
│   │   ├── emailOtp.ts              # Cryptographic Email OTP generation & hashing
│   │   └── history.ts               # Firestore scan history management & caching
│   ├── utils/
│   │   ├── analysis.ts              # Client-side audio processing & legacy DSP utilities
│   │   └── generateAnalysisPDF.ts   # Client-side jsPDF generator with waveform
│   ├── App.tsx                      # Primary application controller, responsive navigation & tab router
│   ├── firebase.ts                  # Firebase client SDK initialization
│   ├── index.css                    # Design system styles, responsive classes & glassmorphism
│   └── main.tsx                     # Application React DOM root
├── functions/
│   ├── src/
│   │   └── index.ts                 # deleteUserAccount Cloud Function (Node 20)
│   ├── package.json                 # Firebase Functions dependencies
│   └── tsconfig.json                # Functions TypeScript configuration
├── ml/
│   ├── models/
│   │   └── deepfake_detector.joblib # Serialized Random Forest model artifact
│   ├── .dockerignore                # Docker build ignore rules
│   ├── Dockerfile                   # Cloud Run container definition
│   ├── api.py                       # FastAPI application & /predict endpoint
│   ├── predict.py                   # 45-feature extraction & model inference logic
│   └── requirements.txt             # Python ML dependencies (scikit-learn, librosa, etc.)
├── public/                          # Static public web assets
├── .env.example                     # Environment template (VITE_ML_API_URL)
├── firebase.json                    # Firebase configuration (Hosting, Functions, Firestore)
├── firestore.rules                  # Firestore security rules
├── package.json                     # Frontend npm dependencies & build scripts
├── vite.config.js                   # Vite configuration
└── README.md                        # Primary project documentation
```

---

## 🔬 How Audio Analysis Works

1. **Audio Input**: User uploads a file (up to 50 MB) or records voice via browser microphone.
2. **Audio Decoding**: Web Audio API decodes audio into an in-memory `AudioBuffer` for real-time waveform display.
3. **ML Inference**: The audio file is submitted via multipart `FormData` to the FastAPI backend (calling `${import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000'}/predict`).
4. **Feature Extraction (`ml/predict.py`)**:
   - 45 distinct acoustic properties extracted via `librosa` and `soundfile`.
   - MFCCs (coefficients 1–13, means and standard deviations — 26 features).
   - Spectral Centroid, Rolloff, Bandwidth, and Flatness means and standard deviations (8 features).
   - Zero-Crossing Rate (ZCR) and RMS Energy means and standard deviations (4 features).
   - Chroma mean & standard deviation, and Tempo (3 features).
   - Fundamental pitch ($F_0$) statistics: mean, standard deviation, minimum, and maximum (4 features).
5. **Random Forest Classification**: Extracted features are evaluated by `ml/models/deepfake_detector.joblib`.
6. **Verdict & Probabilities**:
   - Binary Classification: `REAL` vs `FAKE`.
   - Confidence score percentage (0–100%).
   - Class probabilities (`real` vs `fake`).
7. **Reporting & Persistence**:
   - Analysis results automatically saved to Firestore `/scans`.
   - Instant client-side PDF export with embedded waveform visualization.

---

## ☁️ Production Deployment & Cloud Architecture

VoxForensics is architected for dual-environment execution (local development and cloud production):

1. **Google Cloud Run (Machine Learning API)**:
   - Containerized via `ml/Dockerfile` using `python:3.10-slim` with `ffmpeg` installed.
   - Deployed on **Google Cloud Run**: `https://voxforensics-ml-220640941248.us-central1.run.app`.
   - Auto-scaling container serving `POST /predict` and `GET /health` with managed HTTPS.

2. **Frontend Deployment & Firebase Hosting**:
   - Built to static output via `npm run build` targeting `dist/`.
   - Configured in `firebase.json` with SPA routing rewrites (`** -> /index.html`).
   - Dynamic ML API resolution via `import.meta.env.VITE_ML_API_URL` (configured via `.env.production` in production and `.env.example` template).

3. **Firebase Cloud Functions & Firestore**:
   - Cloud Function `deleteUserAccount` deployed in `us-central1` on Node.js 20.
   - Firestore security rules in `firestore.rules` governing collections `/users`, `/scans`, `/email_otp_sessions`, and `/mail`.

---

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
