# 🧪 VoxForensics - Complete Feature Testing Guide

This guide walks through testing all features of the current VoxForensics application, including **Firebase Authentication**, **Email OTP MFA**, the **Random Forest ML backend**, **Batch Processing**, **Forensic PDF Generation with Waveforms**, and the **Admin Dashboard**.

---

## 📋 System Prerequisites Before Testing

Ensure both services are running locally before starting your test session:

1. **Machine Learning Backend (FastAPI)**:
   ```powershell
   # In Voxforensics2-1 directory
   .\ml\.venv\Scripts\Activate.ps1
   python -m uvicorn ml.api:app --reload --port 8000
   ```
   *Verify healthy startup: visit `http://127.0.0.1:8000/docs` in your browser.*

2. **Frontend Application (Vite)**:
   ```bash
   npm run dev
   ```
   *Application will be live at: `http://localhost:3000`.*

---

## 🧪 Test Suite Checklist

### 1. Authentication & Role-Based Access
- [ ] **Admin Sign-In**: Sign in with `admin@voxforensics.com` / `admin123`.
  - Verify "Admin" badge appears in the top navigation bar.
  - Verify access to the **Admin Dashboard**.
- [ ] **Show/Hide Password Toggle**: Click the eye icon next to the password input field.
  - Verify text switches from hidden (`••••••••`) to plaintext, and the icon toggles.
- [ ] **User Sign-In**: Sign in with `user@example.com` / `user123`.
  - Verify access to the **User Dashboard**.
- [ ] **Email OTP Multi-Factor Authentication**:
  - For accounts with `twoFactorEnabled === true`, verify that after entering email and password, the login halts and presents the 6-digit Email OTP entry screen.
  - Verify the 60-second resend countdown and 10-minute expiry behavior.
- [ ] **New Registration**: Register an account with an email address.
  - Verify email verification notification.
  - Test setting an optional referral code.

---

### 2. Legal Consent Modal
- [ ] **Initial Presentation**: On first sign-in on a fresh browser profile, verify the **Voice Data Usage Agreement** modal appears.
- [ ] **Expandable Sections**: Click on Privacy Policy, Terms of Service, and Data Storage information.
- [ ] **Confirmation Requirement**: Verify the "I Agree" button remains disabled until the confirmation checkbox is ticked.
- [ ] **Acceptance Persistence**: Verify consent status is saved to `localStorage` under `voxforensics_consent`.

---

### 3. Audio Analysis via Random Forest ML Backend

#### A. File Upload Test
1. Navigate to the **Home** or **Scanner** tab.
2. Drag and drop or select an audio file (WAV, MP3, OGG, FLAC, M4A up to 50 MB).
3. Verify the file size and audio player controls appear.
4. Verify the frontend sends `POST /predict` to `http://127.0.0.1:8000/predict`.
5. **Expected Results**:
   - Classification verdict: **REAL** (green badge) or **FAKE / AI-GENERATED** (purple/red badge).
   - Confidence percentage (e.g. 92.4%).
   - Real vs. Fake probability distribution bars.
   - Extracted acoustic metrics table (MFCCs, Spectral Centroid, Rolloff, Pitch Variability, Zero-Crossing Rate).

#### B. Microphone Recording Test
1. Click the **"Start Recording"** button.
2. Allow browser microphone access.
3. Speak for 3–5 seconds and observe live animated waveform visualizer bars.
4. Click **"Stop Recording"**.
5. Verify the audio is packaged and submitted to `/predict`.
6. Confirm analysis results render upon completion.

#### C. Sample Demonstrations
1. Click **"Try sample: Real voice"** button.
   - Verify verdict indicates Authentic/Real with high confidence.
2. Click **"Try sample: AI clone"** button.
   - Verify verdict indicates Synthetic/Deepfake.

---

### 4. Batch Processing Queue
1. Click the **"Batch"** item in the top navigation bar.
2. Click **"Select Multiple Files"** or drag multiple audio files into the dropzone.
3. Verify files appear in the queue with `Pending` status badges.
4. Click **"Start Batch Processing"**.
5. **Observe**:
   - Queue processes sequentially one file at a time without freezing the UI.
   - Progress bar updates with percentage and active filename.
   - Per-file status shifts from `Processing` to `Completed` (or `Error` if a file is corrupted).
   - If an invalid file fails, subsequent files continue processing normally.
6. **Result Verification**:
   - Each completed item displays filename, duration, color-coded verdict badge, confidence score, and a **"PDF"** report button.

---

### 5. Forensic PDF Report Generation with Waveform
1. In either the **Scanner** results panel or the **Batch Processing** table, click **"Download PDF"** (or **"PDF"**).
2. The browser will instantly compile and download a PDF named `VoxForensics-Report-[filename]-[date].pdf`.
3. Open the downloaded PDF and verify:
   - **Branding & Header**: VoxForensics logo, Report ID, and generation timestamp.
   - **File Metadata**: Filename, audio duration, file size.
   - **Forensic Verdict Banner**: Prominently colored authentic or synthetic banner with confidence score.
   - **Waveform Graph**: The actual audio waveform graph rendered visually in the document.
   - **Acoustic Measurements**: Extracted feature values table.
   - **Evidentiary Disclaimer**: Standard legal and forensic disclaimer.
   - **Page Numbering**: "Page X of Y" and confidentiality mark on all pages.

---

### 6. Scan History Management
1. Navigate to the **"History"** tab in the navigation bar.
2. Confirm all recent scans (including single and batch scans) appear with timestamp, filename, verdict, and confidence score.
3. **Individual Deletion**: Click the trash icon on a specific scan record. Verify it is removed from the list and Firestore.
4. **Bulk Deletion**: Click **"Clear All History"** and confirm dialog. Verify all records are wiped.

---

### 7. User Dashboard
1. Sign in as a standard user (`user@example.com`).
2. Click **"👤 Dashboard"** in the navigation header.
3. Verify:
   - Profile avatar, name, email, and "User" role badge.
   - Total Scans and Deepfakes Detected counters.
   - **Referral Program card**: Displays user's unique referral code (`VF-USER001`) with working "Copy" button.
   - Security Status card showing Email OTP MFA toggle.
   - Recent Scans list.

---

### 8. Admin Dashboard & Secure Server-Side Deletion
1. Sign in as the administrator (`admin@voxforensics.com` / `admin123`).
2. Click **"👤 Dashboard"** in the navigation header.
3. Verify:
   - Overview metrics: Total Registered Users, Admins, Regular Users, 2FA Adoption.
   - User Management Table populated from Firestore `/users`.
4. **Role Toggle**:
   - Click "Promote" or "Demote" on a test user. Confirm role updates in Firestore.
5. **Secure Account Deletion Test (`deleteUserAccount`)**:
   - Click "Delete" on a standard test user account.
   - Confirm deletion prompt.
   - Verify the Cloud Function executes successfully, deleting the user from both Firebase Authentication and Firestore.
6. **Safety Boundary Verifications**:
   - Verify that clicking "Delete" on the primary admin (`admin@voxforensics.com`) is rejected.
   - Verify that self-deletion is prevented on the server side.

---

### 9. 3D Visual Experience
1. Open the application on a desktop browser with hardware acceleration enabled.
2. Verify the 3D Three.js particle face silhouette is visible in the background.
3. Observe smooth 60 FPS animation: particle breathing, gentle rotation, and glowing sine waves across the viewport base.
4. Verify high-contrast text readability across glassmorphic cards.
