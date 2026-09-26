# 🔐 VoxForensics Demonstration Credentials & Evaluation Guide

This document provides credentials and step-by-step instructions for evaluation, academic presentation, and demonstration of the VoxForensics application.

---

## 👑 Primary Administrator Account

A primary administrator account is pre-configured in Firebase Authentication for administrative demonstration:

```text
Email:    admin@voxforensics.com
Password: admin123
```
- **Role:** `admin` (System Administrator)
- **Features Unlocked:**
  - Full access to the **Admin Dashboard**
  - Live user management from Firestore `/users`
  - User promotion and demotion
  - **Secure Server-Side Deletion**: Deletes accounts via the `deleteUserAccount` Cloud Function
  - System statistics and MFA adoption metrics
  - All standard audio forensic, scanner, and batch processing features

---

## 👤 Standard User Demonstration Flow

For standard user evaluation, evaluators can either sign in with an existing standard test account (`user@example.com` / `user123`) or demonstrate the complete real-world user registration lifecycle:

1. **Register a New Account**:
   - Open the application at `http://localhost:3000`.
   - Click **"Register"** on the authentication modal.
   - Enter a Name, valid Email address, and Password (minimum 6 characters).
   - *(Optional)* Enter an active referral code (e.g., `VOX-ADMIN01`).
   - Click **"Create Account"**.

2. **Complete Email Verification**:
   - Firebase Authentication automatically dispatches a verification email.
   - The user must open the verification email and click the verification link before proceeding.

3. **Complete Email OTP Verification**:
   - Return to the login screen and enter the verified email and password.
   - During login, the application generates a cryptographically secure 6-digit Email OTP and dispatches it to the user's email.
   - Enter the 6-digit code on the OTP verification screen to complete authentication.

4. **Demonstrating Features with the User Account**:
   - After successful authentication, the evaluator can demonstrate all user-tier capabilities:
     - **Audio Analysis**: Drag-and-drop file upload (up to 50 MB) and live microphone recording with visualizer bars.
     - **Random Forest ML Classification**: Live inference returning real vs. fake verdicts, confidence percentages, and class probabilities.
     - **Batch Processing**: Queuing multiple audio files for sequential analysis with live progress tracking and error isolation.
     - **Forensic PDF Reports**: Downloading evidentiary reports featuring embedded audio waveforms.
     - **Scan History**: Viewing persistent scan records in Firestore with individual or bulk deletion.
     - **User Dashboard**: Viewing personal scan metrics, security settings, and referral program status.
     - **Referral Program**: Accessing and sharing the account's unique referral code (`VOX-XXXXXX`).

---

## 🚀 How to Sign In

### To Sign In as Administrator:
1. Open `http://localhost:3000`.
2. Enter the administrator credentials (`admin@voxforensics.com` / `admin123`).
   *(Click the eye icon to toggle password visibility if needed).*
3. Click **"Login"**.
4. Click **"👤 Dashboard"** in the top navigation bar to open the **Admin Dashboard**.

### To Sign In as a Standard User:
1. Either use existing credentials (`user@example.com` / `user123`) or follow the registration steps above.
2. Enter the credentials on the login screen.
3. Complete the Email OTP step when prompted.
4. Click **"👤 Dashboard"** in the top navigation bar to open the **User Dashboard**.

---

## 🎁 Active Referral Code for Testing Registration

When demonstrating user registration with referral tracking, the evaluator can use the administrator referral code:
- **Referral Code:** `VOX-ADMIN01`

Entering this code during registration links the new user profile (`referredBy: "VOX-ADMIN01"`) and updates the administrator's referral statistics.

---

## 🔒 Security Notice for Evaluation

- Only the primary administrator account (`admin@voxforensics.com`) is pre-configured in Firebase Authentication for evaluation.
- Protection is enforced for the primary administrator: `admin@voxforensics.com` cannot be deleted even by other administrators.
- No fake, non-existent, or hardcoded user credentials are provided. All user testing reflects the live registration, verification, and authentication flow.
