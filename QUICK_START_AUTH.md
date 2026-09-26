# 🚀 Quick Start Guide - Authentication & MFA System

## Welcome to VoxForensics Authentication!

VoxForensics features a secure user management and authentication system powered by **Firebase Authentication**, **Cloud Firestore**, and **Email OTP Multi-Factor Authentication (MFA)**.

---

## ⚡ Quick Start (3 Steps)

### Step 1: Open the Application
Navigate to `http://localhost:3000`. If you are not signed in, the **VoxForensics Authentication Portal** will display.

### Step 2: Sign In or Register

#### Option A: Use a Demo Account (Fastest for Testing)
Pre-configured Firebase Authentication accounts are ready for testing:

```text
👑 Administrator Account:
Email:    admin@voxforensics.com
Password: admin123
Access:   Full Admin Dashboard, user management, secure deletion

👤 Standard User Account:
Email:    user@example.com
Password: user123
Access:   Audio scanning, Batch Processing, Scan History, User Dashboard
```

*Tip: Click the eye icon next to the password input to toggle password visibility.*

#### Option B: Register a New Account
1. Click **"Register"** on the authentication card.
2. Enter your Name, Email, and Password (minimum 6 characters).
3. *(Optional)* Enter a referral code (e.g., `VOX-USER01` or `VOX-ADMIN01`).
4. Click **"Create Account"**.
5. Check your email for the verification link.
6. Choose whether to enable **Email OTP Two-Factor Authentication (MFA)**.

### Step 3: Accept Legal Consent & Start Scanning
1. On first login as a standard user, review the **Voice Data Usage Agreement & Privacy Consent** (admin accounts bypass this step automatically).
2. Check the confirmation box and click **"I Agree"** (stored in `sessionStorage` for the session).
3. You now have access to the main VoxForensics application.
4. Click **"👤 Dashboard"** in the top navigation bar to open your dashboard.
5. Click **"🚪 Logout"** anytime to securely end your session.

---

## 🔐 Two-Factor Authentication (Email OTP MFA)

### How Email OTP Works
VoxForensics utilizes an application-level Email OTP MFA system:
1. **Login**: Enter your email and password.
2. **Detection**: The system detects that `twoFactorEnabled === true` on your account.
3. **OTP Generation**: A secure, 6-digit cryptographic one-time passcode is generated and delivered to your email.
4. **Verification Screen**: The application presents the OTP verification input.
5. **Session Limits**:
   - The code is valid for **10 minutes**.
   - A **60-second cooldown** applies before requesting a resend.
   - You have up to **5 attempts** before the session expires.
6. **Enter Code**: Enter the 6-digit code and click **"Verify OTP"** to enter the app.

---

## 📱 Dashboards Access & Features

### 👤 User Dashboard (Standard Users)
- **Profile Info**: Name, email, member since date, and role badge.
- **Scan Analytics**: Total audio scans performed, deepfake/synthetic voices detected.
- **Referral Program**: Your unique referral code (e.g. `VOX-A1B2C3`), one-click copy button, and list of referred accounts.
- **Security Status**: Email OTP MFA status indicator.
- **Recent Scans**: Overview of recent audio scans with confidence scores.

### 👑 Admin Dashboard (Administrators)
- **System Overview**: Total users registered, administrator count, and MFA adoption metrics.
- **User Management**:
  - View all registered accounts from Firestore.
  - **Promote / Demote**: Toggle administrative privileges for users.
  - **Secure Deletion**: Delete user accounts safely via the `deleteUserAccount` Cloud Function.
- **Security Safeguards**:
  - Self-deletion is prevented.
  - The primary administrator (`admin@voxforensics.com`) cannot be deleted or demoted.

---

## 🎁 Referral Program

1. Open your **User Dashboard**.
2. Locate your unique referral code (e.g., `VOX-XXXXXX`).
3. Click **"Copy"** to copy the code to your clipboard.
4. When a new user registers using your code, their profile is permanently linked (`referredBy`), and your referral count updates in real time.

---

## 🐛 Troubleshooting

### "Invalid email or password"
- Verify that credentials are typed correctly. Use the eye icon to verify typed passwords.
- Ensure the account has been registered in Firebase Authentication.

### "Please verify your email before logging in"
- Firebase Authentication requires email verification for new accounts.
- Check your email inbox (including spam/junk folder) for the verification link from Firebase, click the link, and retry login.

### "OTP code expired or invalid"
- Email OTP codes expire after 5 minutes.
- If expired or typed incorrectly more than 5 times, click **"Resend Code"** (available after the 30-second cooldown).

### "Can't access Admin Dashboard"
- Ensure you are logged in with an administrator account (`admin@voxforensics.com`).
- Standard users only have access to the User Dashboard.
