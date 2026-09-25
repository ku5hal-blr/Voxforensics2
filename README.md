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

- 🤖 **Random Forest ML Detection**: High-accuracy deepfake detection powered by a trained Random Forest model (`models/random_forest_model.pkl`) and FastAPI backend (`ml/api.py`).
- 🔬 **48 Acoustic Features**: Comprehensive feature extraction including MFCCs, spectral centroid, spectral rolloff, spectral flux, zero-crossing rate, pitch variability, and harmonicity.
- 🎙️ **Microphone Recording**: Direct in-browser microphone recording with real-time waveform visualizer bars and simulated fallback.
- 📁 **Audio Upload Support**: Drag-and-drop or file picker upload supporting WAV, MP3, OGG, FLAC, and M4A up to 50 MB.
- 📦 **Batch Processing**: Dedicated top-level tab for queuing multiple audio files with sequential non-blocking analysis, live progress tracking, and per-file PDF downloads.
- 📄 **Forensic PDF Reports**: Client-side PDF generation using jsPDF featuring branded headers, verdict banners, confidence bars, acoustic tables, evidentiary disclaimers, and **embedded audio waveforms**.
- 🔐 **Firebase Authentication & MFA**:
  - Email and password authentication with email verification.
  - Application-level **Email OTP Two-Factor Authentication (MFA)** with cryptographically secure random codes, SHA-256 salted hashing, 10-minute expiry, 60-second resend cooldown, and 5-attempt limits.
  - Show/Hide Password eye toggle on authentication forms.
- 👑 **Role-Based Access & Dashboards**:
  - **Admin Dashboard**: System analytics, registered user management, role toggles, and secure account deletion.
  - **User Dashboard**: Personal scan statistics, referral code sharing, security status, and scan history.
- 🛡️ **Secure Cloud Functions**: Dedicated callable Firebase Cloud Function (`deleteUserAccount` in `us-central1`) using Firebase Admin SDK with server-side admin verification, self-deletion prevention, and primary admin account protection (`admin@voxforensics.com`).
- 🕒 **Scan History**: Full persistent history tracking in Firestore with local caching and individual/bulk deletion.
- 🎁 **Referral Program**: Unique referral codes (`VF-XXXXXX`) tracked across user profiles.
- 📋 **Legal Consent System**: Simplified GDPR/BIPA compliant agreement modal with single-checkbox confirmation and expandable policy sections.
- 🌌 **Cyberpunk 3D Visuals**: Three.js particle face silhouette, glowing sine wave visualizers, and glassmorphic UI components.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VoxForensics Frontend                        │
│             React 18 + TypeScript + Vite + Three.js             │
│        (Home • Scanner • Batch • History • User/Admin Dash)     │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ (Audio Payload / multipart)      │ (Auth / Scans / Roles)
               ▼                                  ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│       ML Backend API          │  │       Firebase Backend       │
│     FastAPI + Python 3.10+    │  │  Firebase Auth (Email/Pass)  │
│  Endpoint: POST /predict      │  │  Firestore Database          │
│  ├─ librosa & soundfile       │  │  ├─ /users                   │
│  ├─ 48 Acoustic Features      │  │  ├─ /scans                   │
│  └─ Random Forest Classifier  │  │  ├─ /email_otp_sessions      │
│     (random_forest_model.pkl) │  │  └─ /mail (Trigger Email)    │
└───────────────────────────────┘  │  Cloud Functions             │
                                   │  └─ deleteUserAccount        │
                                   └──────────────────────────────┘
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
│   ├── App.tsx                      # Primary application controller & tab router
│   ├── firebase.ts                  # Firebase client SDK initialization
│   ├── index.css                    # Design system styles & glassmorphic classes
│   └── main.tsx                     # Application React DOM root
├── functions/
│   ├── src/
│   │   └── index.ts                 # deleteUserAccount Cloud Function (Node 20)
│   ├── package.json                 # Firebase Functions dependencies
│   └── tsconfig.json                # Functions TypeScript configuration
├── ml/
│   ├── .venv/                       # Python virtual environment
│   ├── api.py                       # FastAPI application & /predict endpoint
│   ├── predict.py                   # Feature extraction & model inference logic
│   └── requirements.txt             # Python ML dependencies
├── models/
│   └── random_forest_model.pkl      # Trained Random Forest deepfake detection model
├── public/                          # Static public web assets
├── firestore.rules                  # Firestore security rules
├── package.json                     # Frontend npm dependencies & build scripts
├── vite.config.ts                   # Vite configuration
└── README.md                        # Primary project documentation
```

---

## 🔬 How Audio Analysis Works

1. **Audio Input**: User uploads a file (up to 50 MB) or records voice via browser microphone.
2. **Audio Decoding**: Web Audio API decodes audio into an in-memory `AudioBuffer` for real-time waveform display.
3. **ML Inference**: The audio file is submitted via multipart `FormData` to the FastAPI backend at `http://127.0.0.1:8000/predict`.
4. **Feature Extraction (`ml/predict.py`)**:
   - 48 distinct acoustic properties extracted via `librosa` and `soundfile`.
   - MFCCs (coefficients 1–13, means, and standard deviations).
   - Spectral Centroid, Rolloff, Flux, and Flatness.
   - Zero-Crossing Rate (ZCR) and RMS Energy.
   - Fundamental Frequency (F0/pitch) statistics and Harmonic-to-Noise Ratio (HNR).
5. **Random Forest Classification**: Extracted features are evaluated by `models/random_forest_model.pkl`.
6. **Verdict & Probabilities**:
   - Binary Classification: `REAL` vs `FAKE`.
   - Confidence score percentage (0–100%).
   - Class probabilities (`real` vs `fake`).
7. **Reporting & Persistence**:
   - Analysis results automatically saved to Firestore `/scans`.
   - Instant client-side PDF export with embedded waveform visualization.

---

## 🚢 Upcoming Production Deployment Plan

The current setup operates locally. The production deployment plan involves:

1. **Deploy ML Backend to Google Cloud Run**:
   - Containerize `ml/` with Docker.
   - Deploy container to Google Cloud Run (HTTPS endpoint).
2. **Configure Frontend Production Environment**:
   - Configure `VITE_ML_API_URL` pointing to the secure Cloud Run service.
3. **Deploy Firebase Cloud Functions**:
   - Deploy `deleteUserAccount` to Firebase (`firebase deploy --only functions`).
4. **Deploy Frontend Web Application**:
   - Build via `npm run build` and deploy to Firebase Hosting or Google Cloud Run.
5. **Authorize Production Domains**:
   - Register production domain in Firebase Authentication Console.

---

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
