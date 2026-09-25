# 🔐 VoxForensics Authentication System Documentation

## Overview

VoxForensics implements an enterprise-grade authentication and user management architecture built on **Firebase Authentication**, **Cloud Firestore**, and **Firebase Cloud Functions**, paired with an application-level **Email OTP Multi-Factor Authentication (MFA)** service.

---

## 🎯 Core Features

### 1. User Authentication (Firebase Auth)
- **Email & Password Authentication**: Managed securely via Firebase Authentication Client SDK.
- **Email Verification**: Required upon initial registration (`sendEmailVerification`). Users must verify their email before completing standard login.
- **Show/Hide Password**: Interactive eye icon toggle on password inputs allowing users to verify typed credentials before submission.
- **Session Management**: Native Firebase Auth persistence with real-time observer (`onAuthStateChanged`).
- **Secure Sign-Out**: Full session teardown clearing local states and memory caches.

### 2. Application-Level Email OTP Multi-Factor Authentication (MFA)
VoxForensics features a dedicated Email OTP service (`src/services/emailOtp.ts`):
- **Cryptographic Randomness**: 6-digit OTP generated via `crypto.getRandomValues(new Uint32Array(1))` rather than insecure pseudorandom generators.
- **Salted SHA-256 Hashing**: The plaintext OTP is never stored directly. It is salted with a unique random hex string and hashed using `crypto.subtle.digest('SHA-256', ...)` before saving or comparison.
- **Session Expiration**: OTP sessions strictly expire after **10 minutes** (`10 * 60 * 1000 ms`).
- **Resend Cooldown**: A **60-second** cooldown timer prevents abuse and spamming.
- **Attempt Limiting**: A maximum of **5 failed verification attempts** is permitted before the session is automatically invalidated.
- **Single-Use Enforcement**: Verified OTP sessions are flagged as `used: true` immediately, preventing replay attacks.
- **Email Dispatch Pipeline**: Integrates with Firestore's `/mail` collection (compatible with Firebase Trigger Email extension) with an in-memory session fallback store.
- **Recurring MFA**: When `twoFactorEnabled === true`, the user must complete Email OTP verification on every new login session.

### 3. Role-Based Access Control (RBAC)
- **User Role (`user`)**: Access to Audio Scanner, Batch Processing, Scan History, Personal Profile, and Referral Program.
- **Administrator Role (`admin`)**: Access to all user features plus the **Admin Dashboard**, user list management, system analytics, and account deletion.
- **Primary Administrator**: The primary system admin (`admin@voxforensics.com`) is protected against role demotion and account deletion.

### 4. Admin Dashboard & Secure Server-Side Deletion
- **User Management**: View all registered users, registration dates, 2FA status, and assigned roles.
- **Role Assignment**: Promote or demote users between `user` and `admin` roles.
- **Secure Cloud Function Deletion (`deleteUserAccount`)**:
  - Callable Cloud Function located in `functions/src/index.ts` running on **Node.js 20** in region `us-central1`.
  - Server-side authorization check via Firebase Admin SDK confirming the caller has `role === 'admin'`.
  - Self-deletion prevention (`callerUid === targetUid` rejected).
  - Primary admin protection (`admin@voxforensics.com` cannot be deleted).
  - Atomically deletes the user from Firebase Authentication and removes their Firestore document from `/users`.

### 5. User Dashboard & Referral Program
- **Personal Statistics**: Total scans performed, synthetic voices detected, and referral counts.
- **Unique Referral Code**: Automatically generated unique referral identifier (`VF-XXXXXX`) assigned to each account.
- **Referral Relationship**: Stores `referredBy` metadata during registration when a referral code is supplied.
- **Security Status**: Displays current 2FA status and security recommendations.

---

## 🔄 Complete Authentication Flow

### A. Registration Flow

```
1. User enters Name, Email, Password, (Optional) Referral Code
   ↓
2. User clicks Register (Show/Hide toggle available)
   ↓
3. Firebase Auth creates account: createUserWithEmailAndPassword()
   ↓
4. Verification email dispatched: sendEmailVerification()
   ↓
5. Firestore profile created in /users/{userId}:
   - name, email, role: 'user', referralCode, referredBy, twoFactorEnabled: false
   ↓
6. User prompted with 2FA setup option (enable Email OTP or skip)
   ↓
7. User prompted to verify email before standard login
```

### B. Standard User Login Flow (with Email OTP MFA)

```
1. User enters Email and Password
   ↓
2. Firebase Auth authenticates: signInWithEmailAndPassword()
   ↓
3. System loads Firestore profile from /users/{userId}
   ↓
4. System checks email verification status (user.emailVerified)
   ├─ Not Verified → Block login, show verification screen
   └─ Verified → Proceed
   ↓
5. System checks twoFactorEnabled status:
   ├─ If twoFactorEnabled === true:
   │    1. Generate 6-digit cryptographic OTP
   │    2. Compute SHA-256(salt + OTP)
   │    3. Store hashed session in /email_otp_sessions and queue email in /mail
   │    4. HALT login completion; show Email OTP screen
   │    5. User enters 6-digit OTP
   │    6. emailOtpService.verifyOtp() validates hash, expiration & attempts
   │    7. Mark session as MFA-verified
   │    └─ Proceed to Consent Flow
   │
   └─ If twoFactorEnabled === false:
        └─ Proceed to Consent Flow
   ↓
6. Consent Flow:
   - Check if consent accepted in localStorage
   - If not accepted → Show ConsentModal
   - If accepted → Load main application
```

### C. Administrator Login Flow

```
1. Admin enters credentials (e.g., admin@voxforensics.com)
   ↓
2. Firebase Auth authenticates
   ↓
3. System loads profile and detects role === 'admin'
   ↓
4. Admin session established
   ↓
5. User Info Bar displays "Admin" badge and unlocks Admin Dashboard access
```

---

## 👥 Demo / Evaluation Accounts

The project includes pre-configured Firebase Authentication accounts for demonstration and college evaluation:

### 👑 Administrator Account
- **Email:** `admin@voxforensics.com`
- **Password:** `admin123`
- **Role:** `admin`
- **Privileges:** Admin Dashboard access, user analytics, Cloud Function user deletion.

## 🗄️ Database Schema (Firestore)

### Collection: `/users/{userId}`
```typescript
interface UserProfile {
  id: string;               // Firebase Auth UID
  name: string;             // User display name
  email: string;            // User email address
  role: 'admin' | 'user';   // Role identifier
  referralCode: string;     // Unique code (e.g. "VF-A1B2C3")
  referredBy?: string;      // Referral code of inviter (optional)
  twoFactorEnabled: boolean;// MFA toggle
  createdAt: string;        // ISO timestamp
  updatedAt?: string;       // ISO timestamp
}
```

### Collection: `/email_otp_sessions/{sessionId}`
```typescript
interface EmailOtpSession {
  id: string;               // Unique session ID
  userId: string;           // Target user UID
  email: string;            // Target recipient email
  hashedOtp: string;        // SHA-256 salted hash of 6-digit OTP
  salt: string;             // Unique cryptographic salt
  expiresAt: number;        // Expiration timestamp in ms (+10 min)
  attempts: number;         // Failed attempt counter (max 5)
  used: boolean;            // Single-use flag
  createdAt: number;        // Creation timestamp in ms
}
```

### Collection: `/mail/{mailId}`
```typescript
interface MailMessage {
  to: string;               // Recipient email
  message: {
    subject: string;        // Email subject line
    text: string;           // Plaintext fallback
    html: string;           // Branded HTML email body with OTP code
  };
}
```

---

## 🛡️ Cloud Function: `deleteUserAccount`

Located in `functions/src/index.ts`:

- **Type**: Callable HTTPS Cloud Function (`onCall`).
- **Region**: `us-central1`.
- **Runtime**: Node.js 20.
- **Security Validations**:
  1. `context.auth != null`: Rejects unauthenticated requests.
  2. Queries Firestore `/users/{callerUid}`: Validates caller's role is strictly `admin`.
  3. `callerUid !== targetUid`: Prevents administrators from accidentally deleting their own accounts.
  4. Protected primary admin: Validates target account is not `admin@voxforensics.com`.
  5. Performs atomic deletion: `admin.auth().deleteUser(targetUid)` and `usersRef.doc(targetUid).delete()`.
