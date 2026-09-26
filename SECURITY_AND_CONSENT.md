# 🛡️ VoxForensics - Security, Consent & Data Governance Documentation

## 1. Security Architecture Overview

VoxForensics implements multi-layered security spanning frontend input validation, cryptographic Multi-Factor Authentication (MFA), server-side Cloud Function authorization, and secure audio processing.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│  - Client-side File Validation (50 MB limit, MIME types)        │
│  - Password Visibility Toggle                                   │
│  - Biometric & Privacy Consent Modal                            │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ (POST /predict)                  │ (Firebase SDK)
               ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│       ML Backend (FastAPI)   │   │       Firebase Platform      │
│  - Ephemeral Temp Audio      │   │  - Firebase Authentication   │
│  - Librosa Preprocessing     │   │  - Email OTP Service (SHA-256)
│  - Random Forest Classifier  │   │  - Cloud Firestore           │
│  - Automatic File Cleanup    │   │  - Cloud Function:           │
└──────────────────────────────┘   │    deleteUserAccount         │
                                   │    (Admin SDK Authorization) │
                                   └──────────────────────────────┘
```

---

## 2. Authentication & Identity Protection

### Firebase Authentication
- Authentication is governed by Firebase Authentication using encrypted credentials.
- **Email Verification**: Required upon user registration. Standard users cannot proceed to the dashboard until verifying their email address.
- **Show/Hide Password**: Prevents input errors by allowing users to temporarily view typed credentials while masking characters by default.

### Application-Level Email OTP Multi-Factor Authentication (MFA)
VoxForensics integrates an application-level Email OTP service (`src/services/emailOtp.ts`):
1. **Cryptographic Randomness**: OTPs are generated using `crypto.getRandomValues(new Uint32Array(1))` mapped to a 6-digit integer (100000–999999).
2. **Salted SHA-256 Hashing**:
   - Plaintext OTPs are never stored directly in Firestore or application state.
   - A unique 16-byte cryptographic salt is generated for each OTP session.
   - The session record stores `SHA-256(salt + OTP)`.
   - Verification re-hashes the user's input with the session salt and performs string comparison.
3. **Session Expiry**: Sessions are strictly valid for **10 minutes** (`10 * 60 * 1000 ms`).
4. **Resend Cooldown**: A **60-second cooldown** prevents email flooding.
5. **Attempt Limiting**: Sessions permit a maximum of **5 failed attempts** before permanent invalidation.
6. **Single-Use Enforcement**: Upon successful verification, `used: true` is stamped on the session record to prevent replay attacks.
7. **Delivery Channel**: Integrates with Firestore's `/mail` collection (compatible with Firebase Trigger Email extension) with an in-memory session fallback store.

---

## 3. Server-Side Administrative Security (Cloud Functions)

The account deletion feature is governed by the `deleteUserAccount` callable Cloud Function in `functions/src/index.ts`:

- **Execution Environment**: Node.js 20, Region `us-central1`.
- **Authorization Boundary**: The server-side function independently queries `/users/{callerUid}` in Firestore to verify that `callerData.role === 'admin'`.
- **Self-Deletion Protection**: Prevents administrators from deleting their own active account (`callerUid === targetUid` is rejected with `failed-precondition`).
- **Primary Administrator Protection**: Enforces an explicit check ensuring `targetData.email !== 'admin@voxforensics.com'`. The primary system administrator account cannot be deleted under any circumstances.
- **Atomic Execution**: Deletes the user from Firebase Authentication via `admin.auth().deleteUser(targetUid)` and purges their document from `/users/{targetUid}` in Firestore.

---

## 4. File Upload & Audio Processing Security

### Client-Side Validation (`src/App.tsx`)
- **File Size Ceiling**: Strictly capped at **50 MB** (`MAX_FILE_SIZE = 50 * 1024 * 1024`). Files exceeding this size are rejected before upload.
- **Allowed Formats**: Accepts standard audio containers (`.wav`, `.mp3`, `.ogg`, `.flac`, `.m4a`).
- **Memory Management**: Audio Object URLs generated for in-browser playback are revoked via `URL.revokeObjectURL()` in cleanup hooks to prevent browser memory leaks.

### ML API Processing (`ml/api.py`)
- Uploaded audio streams are written to isolated temporary files with standard unique identifiers.
- Audio is normalized to 16 kHz mono WAV via FFmpeg.
- Temporary audio files are removed from the filesystem in a `finally:` block immediately after feature extraction.

---

## 5. Voice Data Consent System

### Legal Framework & Compliance
VoxForensics complies with international biometric and consumer privacy standards:
- **GDPR** (EU General Data Protection Regulation, Article 9 - Biometric Data)
- **BIPA** (Illinois Biometric Information Privacy Act - 740 ILCS 14/)
- **CCPA** (California Consumer Privacy Act)
- **COPPA** (Children's Online Privacy Protection Act)

### Consent Implementation
- **Streamlined User Experience**:
  - Replaces cumbersome multi-checkbox forms with a single clear confirmation checkbox: *"I confirm that I have read and understood the above information"*.
  - Enables clear action buttons: **"I Agree"** and **"I Don't Agree"**.
- **Expandable Legal Sections**:
  - **Voice Data Usage**: Details the collection and AI extraction of acoustic metrics.
  - **Privacy Policy**: Explains data governance, lack of third-party sharing, and user deletion rights.
  - **Terms of Service**: Disclaims that the software provides forensic estimates, not definitive legal evidence.
  - **Data Storage Information**: Clarifies that voice recordings are ephemeral and deleted after processing.
- **Storage**: User consent confirmation is persisted in browser `sessionStorage` under `voxforensics_consent_${user.id}`. Admin accounts (`role === 'admin'`) automatically bypass the modal.
- **Revocation**: Users can revoke consent via the User Dashboard, which clears their session consent record (`sessionStorage.removeItem`) and resets application consent status.

---

## 6. Data Storage & Lifecycle Governance

| Data Type | Storage Location | Retention Lifecycle | Encryption & Access |
| :--- | :--- | :--- | :--- |
| **User Profiles** | Firestore `/users` | Maintained until account deletion | Restricted via Firestore Security Rules |
| **Scan Metadata** | Firestore `/scans` | Maintained until deleted by user | Queryable by authenticated users |
| **Audio Files** | Ephemeral RAM / Temp files | Seconds (duration of ML extraction only) | Automatically unlinked / deleted |
| **OTP Sessions** | `/email_otp_sessions` & Memory | 10 minutes (expires automatically) | Salted SHA-256 hash |
| **Consent State** | Browser `sessionStorage` (`voxforensics_consent_${userId}`) | Active session (cleared on logout or revocation; bypassed by admins) | Client-side memory session storage |

---

## 7. Security Best Practices for Production Deployment

1. **Production CORS Configuration**: Replace `allow_origins=["*"]` in `ml/api.py` with the exact production domain.
2. **Server-Side File Validation**: Add a 50 MB streaming byte cap in `ml/api.py` to complement client-side validation.
3. **HTTPS Enforcement**: Ensure both the frontend and ML API on Google Cloud Run communicate exclusively over TLS/HTTPS.
4. **Firestore Rules Hardening**: Ensure user updates cannot modify their own `role` or `twoFactorEnabled` fields directly from client SDKs.
