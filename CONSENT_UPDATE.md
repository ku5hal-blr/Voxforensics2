# 📋 VoxForensics - Consent System & Privacy Policy Documentation

## 🔄 Consent Flow Overview

VoxForensics implements a transparent legal agreement flow to ensure compliance with international biometric data and privacy laws (GDPR, BIPA, CCPA).

The consent system employs a streamlined, single-checkbox confirmation model with expandable legal disclosures:
- **Single Confirmation Checkbox**: *"I confirm that I have read and understood the above information"*.
- **Clear Action Buttons**: **"✅ I Agree"** (enabled only when checked) and **"❌ I Don't Agree"**.
- **Expandable Legal Sections**: Lets users inspect full policies without being overwhelmed by multiple form fields.

---

## 📋 How It Works

### 1. Presentation
- On first login or new browser session, the **Voice Data Usage Agreement** modal appears automatically before access to forensic tools is granted.
- **Admin Bypass**: Accounts with administrative privileges (`role === 'admin'`) automatically bypass the consent modal.

### 2. Policy Disclosures
- **Voice Data Usage** (always visible): Explains that audio submitted via file upload or microphone capture is analyzed to extract acoustic parameters for deepfake classification. Clarifies that audio recordings are ephemeral and deleted after feature extraction.
- **Privacy Policy** (expandable): Describes data governance, account storage in Cloud Firestore, and user rights.
- **Terms of Service** (expandable): Specifies acceptable use, accuracy disclaimers, and educational/analytical context.
- **Data Storage Information** (expandable): Clarifies the separation between ephemeral audio files and persistent scan metadata in Firestore.

### 3. User Choice
- **Click "I Agree"**: Saves `'true'` to `sessionStorage` under the user-scoped key `voxforensics_consent_${user.id}`, granting access to the forensic workspace.
- **Click "I Don't Agree"**: Access is restricted until consent is granted.

---

## 🔐 Consent Storage & Verification

### Storage Location & Scoping
- **Storage**: Browser `sessionStorage`
- **Key**: `voxforensics_consent_${user.id}` (scoped per user UID)
- **Value**: String `'true'`

### Lifecycle & Session Management
- **Page Refreshes**: `sessionStorage` persists consent across browser tab refreshes for the active session.
- **Logout Cleansing**: When the user logs out (`!user`), the application cleanses `sessionStorage.removeItem('voxforensics_consent_' + previousUserId)` so consent is re-evaluated upon the next login session.
- **Admin Accounts**: Administrator accounts automatically evaluate `hasConsented = true` upon login.

### Revocation
Users can revoke their consent via the User Dashboard:
- Invokes `revokeConsent()`, which removes `voxforensics_consent_${user.id}` from `sessionStorage` and sets `hasConsented = false`.
- Displays the consent agreement again before subsequent audio analyses.
- The Admin Dashboard additionally includes a client cache reset button clearing legacy and session cache keys.

---

## 🛡️ Legal Compliance Summary

- **GDPR (Article 9)**: Obtains explicit consent for biometric voice analysis.
- **BIPA (740 ILCS 14/)**: Provides written disclosure regarding temporary biometric feature extraction.
- **CCPA / CPRA**: Informs users regarding data collection categories and deletion rights.
- **COPPA**: Enforces age requirements (18+ or parental consent).
