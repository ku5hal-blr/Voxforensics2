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

### 2. Policy Disclosures
- **Voice Data Usage** (always visible): Explains that audio submitted via file upload or microphone capture is analyzed to extract acoustic parameters for deepfake classification. Clarifies that audio recordings are ephemeral and deleted after feature extraction.
- **Privacy Policy** (expandable): Describes data governance, account storage in Cloud Firestore, and user rights.
- **Terms of Service** (expandable): Specifies acceptable use, accuracy disclaimers, and educational/analytical context.
- **Data Storage Information** (expandable): Clarifies the separation between ephemeral audio files and persistent scan metadata in Firestore.

### 3. User Choice
- **Click "I Agree"**: Consent record is saved to browser storage, and the user enters the application.
- **Click "I Don't Agree"**: Access is restricted until consent is granted.

---

## 🔐 Consent Storage & Verification

### Storage Location
- **Key**: `voxforensics_consent`
- **Location**: Browser `localStorage`
- **Format**:
  ```json
  {
    "agreed": true,
    "timestamp": "2026-09-25T10:30:00.000Z",
    "version": "1.0.0"
  }
  ```

### Revocation
Users can revoke their consent at any time via the User Dashboard:
- Deletes the `voxforensics_consent` entry from browser storage.
- Requires re-acceptance of the agreement upon the next scan attempt.

---

## 🛡️ Legal Compliance Summary

- **GDPR (Article 9)**: Obtains explicit consent for biometric voice analysis.
- **BIPA (740 ILCS 14/)**: Provides written disclosure regarding temporary biometric feature extraction.
- **CCPA / CPRA**: Informs users regarding data collection categories and deletion rights.
- **COPPA**: Enforces age requirements (18+ or parental consent).
