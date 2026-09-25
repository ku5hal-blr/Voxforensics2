# 🌟 VoxForensics - Complete System Features Summary

This document outlines the complete set of features currently active in the VoxForensics application.

---

## 🚀 Feature Matrix

| Feature | Subsystem | Description | Location / File |
| :--- | :--- | :--- | :--- |
| **Random Forest ML Audio Detection** | ML Backend | Predicts Authentic (`REAL`) vs Deepfake (`FAKE`) using a trained model with 48 acoustic features | `ml/api.py`, `models/random_forest_model.pkl` |
| **FastAPI REST API** | ML Backend | High-performance Python backend serving inference at `/predict` | `ml/api.py` |
| **Audio File Upload** | Frontend | Drag & drop or file selector supporting WAV, MP3, OGG, FLAC, M4A up to 50 MB | `src/App.tsx` |
| **Microphone Voice Recording** | Frontend | Live browser audio capture with real-time waveform visualization bars | `src/App.tsx` |
| **Batch Processing** | Frontend / ML | Dedicated tab for queuing multiple audio files, sequential analysis, and per-file PDF generation | `src/components/BatchProcessing.tsx` |
| **Forensic PDF Reports with Waveform** | Forensic Reporting | Client-side jsPDF report generator embedding audio waveform graphics, acoustic metrics, and legal disclaimers | `src/utils/generateAnalysisPDF.ts` |
| **Firebase Authentication** | Auth & Identity | Secure user registration, email/password login, and session persistence | `src/components/AuthSystem.tsx`, `src/firebase.ts` |
| **Email Verification** | Auth & Identity | Mandatory verification link for new user registrations via Firebase Auth | `src/components/AuthSystem.tsx` |
| **Email OTP Multi-Factor Authentication** | Auth & Security | Cryptographically secure 6-digit OTP MFA with salted SHA-256 hashing, 10m expiry, and 60s cooldown | `src/services/emailOtp.ts` |
| **Password Visibility Toggle** | Frontend / UX | Eye icon toggle allowing users to view/hide entered passwords | `src/components/AuthSystem.tsx` |
| **Admin Dashboard** | Administration | View registered users, manage user roles (promote/demote), view system stats | `src/components/AdminDashboard.tsx` |
| **Secure Admin User Deletion** | Cloud Functions | Callable Cloud Function `deleteUserAccount` using Firebase Admin SDK with primary admin protection | `functions/src/index.ts` |
| **User Dashboard** | User Profile | View personal scan metrics, recent scan history, and security settings | `src/components/UserDashboard.tsx` |
| **Referral System** | Growth & Tracking | Unique user referral codes (`VF-XXXXXX`) tracked during registration | `src/components/UserDashboard.tsx` |
| **Scan History** | Data Persistence | Persistent record of audio scans stored in Firestore `/scans` with local caching and deletion | `src/services/history.ts` |
| **Legal Consent System** | Compliance | Single-confirmation checkbox with expandable policies compliant with GDPR and BIPA | `src/components/ConsentModal.tsx` |
| **3D Cyberpunk Background** | Visuals / UI | Interactive Three.js particle face silhouette with animated glowing wave visualizers | `src/components/LiveBackground.tsx` |

---

## 🔬 In-Depth Subsystem Descriptions

### 1. Audio Deepfake Detection Pipeline
- **Input Formats**: Accepts `.wav`, `.mp3`, `.ogg`, `.flac`, and `.m4a` files up to **50 MB**.
- **Preprocessing**: Normalizes audio sampling to 16 kHz mono.
- **Feature Extraction**: Extracts 48 acoustic parameters (MFCCs, spectral centroid, spectral rolloff, spectral flux, zero-crossing rate, pitch variability, and harmonicity).
- **Classification**: Evaluated by `models/random_forest_model.pkl` to compute class probabilities.
- **Output**: Returns verdict (`REAL` or `FAKE`), confidence score (0–100%), and granular probability distributions.

### 2. Batch Audio Processing
- Top-level **"Batch"** navigation tab.
- Supports multi-file selection or multi-file drag-and-drop.
- **Sequential Queue**: Processes files sequentially through the ML backend to prevent memory spikes.
- **Error Isolation**: Corrupt or unreadable files produce an error status for that specific file without halting the remaining queue.
- **Live Progress**: Progress bar displaying overall completion percentage and active processing item.
- **Individual PDF Generation**: Users can download an evidentiary PDF report for any completed file in the batch results table.

### 3. Evidentiary Forensic PDF Reports
- Generated completely client-side in the browser using `jspdf`.
- **Branded Design**: Clean dark header with VoxForensics identity and unique Report ID.
- **Embedded Audio Waveform**: Renders the actual audio waveform graph directly into the PDF document.
- **Acoustic Metrics**: Detailed table of extracted acoustic features and metrics.
- **Summary & Diagnostics**: Technical observations describing why the voice was classified as authentic or synthetic.
- **Evidentiary Disclaimer**: Formal statement clarifying analytical limitations for legal compliance.
- **Pagination**: Professional page numbers ("Page X of Y") and confidentiality notices.

### 4. Authentication, MFA & User Management
- Built on **Firebase Authentication** with real-time auth state synchronization.
- **Application-Level Email OTP**:
  - Secure randomness: `crypto.getRandomValues()`.
  - Salted SHA-256 hash storage before verification.
  - 10-minute expiration and 60-second resend cooldown.
  - Max 5 failed verification attempts before invalidation.
- **Admin Security**:
  - Protected primary administrator (`admin@voxforensics.com`).
  - Server-side validation via Cloud Function `deleteUserAccount` in region `us-central1`.
  - Self-deletion is prevented on the server side.

### 5. Legal & Biometric Consent System
- Streamlined modal appearing on first use.
- Requires user to tick: *"I confirm that I have read and understood the above information"*.
- Expandable legal policies covering Voice Data Usage, Privacy Policy, Terms of Service, and Data Storage.
- Consent is recorded in `localStorage` under `voxforensics_consent`.
