# 📊 VoxForensics - College Presentation & Project Guide

## 🎯 Project Overview for Academic Presentation

**Project Title:** VoxForensics — AI-Powered Deepfake Audio Detection & Forensic Analysis System  
**Academic Scope:** Final Year Computer Science / BCA Capstone Project  
**Core Technologies:** React 18, TypeScript, Python 3.10+, FastAPI, Scikit-learn (Random Forest), Firebase Authentication & Cloud Functions, Three.js, jsPDF.

---

## 📑 Slide-by-Slide Presentation Structure

### Slide 1: Title Slide
- **Title:** VoxForensics: AI-Powered Deepfake Audio Detection & Forensic Analysis
- **Subtitle:** Multi-tier acoustic analysis and biometric verification architecture
- **Presenter Information:** Student Name, Roll Number, Academic Guide / Department

### Slide 2: Abstract
- Addresses the rising threat of synthetic voice generation and AI voice cloning (e.g. ElevenLabs, neural vocoders).
- Introduces VoxForensics: A production-grade system combining high-performance **Random Forest Machine Learning**, **Firebase Cloud Infrastructure**, and a **React & Three.js forensic interface**.
- Key achievements: 45-feature acoustic analysis, real-time waveform visualization, batch processing, and evidentiary PDF reporting.

### Slide 3: Problem Statement
- **Deepfake Threat Landscape**: CEO voice fraud, social engineering attacks, synthetic disinformation in elections, and identity spoofing.
- **Human Inability to Detect**: Modern diffusion and neural vocoder speech models generate audio that human ears cannot reliably distinguish from genuine recordings.
- **Need for Specialized Tools**: Organizations and law enforcement require automated forensic tools with quantifiable confidence scores and audit trails.

### Slide 4: System Architecture
- **Tier 1 (Frontend)**: React 18, TypeScript, Vite, Tailwind CSS, Three.js 3D particle canvas, and mobile-responsive drawer navigation.
- **Tier 2 (ML Backend)**: Python FastAPI server serving `POST /predict`, normalizing audio to 16 kHz mono.
- **Tier 3 (Inference Engine)**: 45-feature acoustic extraction pipeline (librosa, soundfile) paired with a trained `Random Forest Classifier` (`ml/models/deepfake_detector.joblib`).
- **Tier 4 (Cloud Infrastructure)**: Firebase Authentication, Cloud Firestore (`/users`, `/scans`, `/email_otp_sessions`, `/mail`), and callable Cloud Functions (`deleteUserAccount` in Node 20).

### Slide 5: Acoustic Feature Extraction (45 Features)
- **Mel-Frequency Cepstral Coefficients (MFCCs 1–13)**: Mean and standard deviation representing vocal tract resonance (26 features).
- **Spectral Features**: Centroid, Rolloff, Bandwidth, Flatness means & standard deviations (8 features).
- **Temporal & Energy Metrics**: Zero-Crossing Rate (ZCR) and RMS Energy means & standard deviations (4 features).
- **Chroma & Rhythm**: Chroma mean & standard deviation, and Tempo (3 features).
- **Pitch Statistics**: Fundamental pitch mean, standard deviation, minimum, and maximum (4 features).

### Slide 6: Machine Learning Pipeline
- Trained Random Forest model evaluates the 45-dimensional feature vector.
- Generates binary classification verdict (`REAL` vs `FAKE`).
- Computes calibrated confidence percentages and real/fake probability distributions.
- *Note on Architecture*: Early prototypes explored browser-only DSP heuristics (`src/utils/analysis.ts`), but current production inference is powered by the Python Random Forest model.

### Slide 7: Security & Multi-Factor Authentication (MFA)
- **Firebase Authentication**: Email and password authentication with email verification.
- **Application-Level Email OTP MFA**:
  - Secure random 6-digit PIN generated via `crypto.getRandomValues()`.
  - Stored and compared using **salted SHA-256 hashing**.
  - Enforced 10-minute expiry, 60-second resend cooldown, and 5-attempt limit.
- **Password Visibility**: Show/hide eye icon for accessible credential entry.

### Slide 8: Administrative Security & Cloud Functions
- **Admin Dashboard**: System metrics, registered users, and role management.
- **Callable Cloud Function (`deleteUserAccount`)**:
  - Executes in Node 20 (`us-central1`).
  - Server-side Admin SDK authorization confirms the caller is an administrator.
  - Self-deletion protection (`callerUid === targetUid` rejected).
  - Primary admin protection (`admin@voxforensics.com` cannot be deleted).
  - Deletes user from Firebase Auth and Firestore atomically.

### Slide 9: Batch Processing & Workflow Scalability
- Dedicated **"Batch"** top-level tab.
- Supports multi-file drag-and-drop up to 50 MB per file.
- Sequential non-blocking processing through the ML backend.
- Error isolation: single corrupt file does not halt the queue.
- Live progress indicator and per-file PDF report download.

### Slide 10: Evidentiary Forensic PDF Reports
- Client-side report generation using `jspdf`.
- **Embedded Audio Waveform**: Directly renders the audio waveform graph into the PDF.
- Complete metadata: Report ID, generation timestamp, filename, file duration.
- Verdict banner with confidence score and real/fake probability distribution.
- Acoustic measurements table and technical diagnostics.
- Formal evidentiary and legal disclaimer.

### Slide 11: Privacy & Legal Compliance
- **GDPR Article 9**: Explicit biometric consent obtained prior to processing.
- **Illinois BIPA (740 ILCS 14/)**: Written disclosure of biometric voice analysis.
- **Ephemeral Audio Lifecycle**: Voice audio is processed only in temporary memory during feature extraction and is unlinked immediately.

### Slide 12: Demonstration Walkthrough
- Sign in as Admin (`admin@voxforensics.com` / `admin123`) to demonstrate Admin Dashboard and Cloud Function deletion safeguards.
- Sign in as User (`user@example.com` / `user123`) to demonstrate:
  1. Microphone recording with live waveform.
  2. Single file upload and Random Forest classification.
  3. Batch processing queue with multiple files.
  4. Instant PDF report download with embedded waveform.
  5. User Dashboard referral code sharing.

### Slide 13: Production Architecture & Future Scope
- **Production Cloud Architecture (Live)**:
  1. FastAPI backend containerized via Docker and deployed to **Google Cloud Run** (`https://voxforensics-ml-220640941248.us-central1.run.app`).
  2. Dynamic frontend API configuration using `import.meta.env.VITE_ML_API_URL`.
  3. Production Firebase Hosting configured in `firebase.json` (`dist` with SPA routing).
  4. Firebase Cloud Functions (`deleteUserAccount`) on Node.js 20 in `us-central1`.
- **Future Enhancements**: Deep learning transformer models (Wav2Vec 2.0 / Whisper representations), real-time streaming WebSockets, and multi-speaker diarization.

### Slide 14: Conclusion
- Summary of project achievements: End-to-end deepfake detection system with enterprise authentication, robust ML inference, scalable batch scanning, and evidentiary reporting.
- Open floor for questions and professor evaluation.

---

## 💡 Practical Presentation Tips

1. **Start Services First (Local Testing)**: Make sure Uvicorn (`python -m uvicorn ml.api:app --reload --port 8000`) and Vite (`npm run dev`) are running before the presentation begins. Alternatively, demonstrate with the deployed Google Cloud Run ML API.
2. **Have Both Accounts Ready**: Use `admin@voxforensics.com` to demonstrate admin features and `user@example.com` to demonstrate scanning.
3. **Show the PDF Report**: Open a generated PDF in Adobe Reader or browser to highlight the embedded waveform graph and forensic formatting.
4. **Demonstrate Mobile Responsiveness**: Switch Chrome DevTools to a mobile viewport (e.g., iPhone 14) to showcase the hamburger drawer and responsive UI.
