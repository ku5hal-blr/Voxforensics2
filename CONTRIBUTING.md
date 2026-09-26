# Contributing to VoxForensics

Thank you for your interest in contributing to VoxForensics! This document provides guidelines and environment setup instructions for developers.

---

## 💻 Local Development Setup

VoxForensics consists of a **React + TypeScript frontend**, a **Python FastAPI Machine Learning backend**, and **Firebase Cloud Functions**.

### Prerequisites
- **Node.js**: v20+ recommended
- **npm**: v9+
- **Python**: v3.10+
- **FFmpeg**: Installed and added to system `PATH` (used by the audio pipeline for format conversions)
- **Git**

---

### Step-by-Step Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/voxforensics.git
cd voxforensics
```

#### 2. Configure the Frontend
```bash
# Install root dependencies
npm install

# Start the frontend development server
npm run dev
```
The frontend will start at: `http://localhost:3000`

#### 3. Configure the Machine Learning Backend
In a separate terminal:
```powershell
# Activate the virtual environment (Windows PowerShell)
.\ml\.venv\Scripts\Activate.ps1

# (If initializing a fresh environment)
# pip install -r ml/requirements.txt

# Start the FastAPI server using Uvicorn
python -m uvicorn ml.api:app --reload --port 8000
```
The API will start at: `http://127.0.0.1:8000` (Docs at `/docs`)

#### 4. Configure Firebase Cloud Functions (Optional)
```bash
cd functions
npm install
npm run build
cd ..
```

---

## 🧪 Testing Guidelines

Before submitting changes, perform the following validation checks:

### 1. Code Quality & Type Checks
```bash
# Run TypeScript type check on frontend
npm run typecheck

# Build frontend to ensure clean production compilation
npm run build
```

### 2. Functional Manual Verification
- [ ] **Authentication**: Test login with `admin@voxforensics.com` and `user@example.com`.
- [ ] **MFA**: Verify Email OTP generation, 60s cooldown, and 5-attempt limits.
- [ ] **Audio Upload**: Upload WAV, MP3, and M4A files up to 50 MB.
- [ ] **Microphone Recording**: Test in-browser recording with real-time waveform bars.
- [ ] **ML Analysis**: Confirm results return from `${import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000'}/predict` with confidence and 45 acoustic metrics.
- [ ] **Batch Processing**: Queue multiple files and confirm non-blocking sequential execution.
- [ ] **PDF Export**: Generate a PDF report and ensure the waveform graph renders cleanly.
- [ ] **Mobile Responsiveness**: Verify hamburger drawer navigation and responsive layouts across 320px–430px mobile viewports.
- [ ] **Admin Dashboard**: Test user role updates and Cloud Function user deletion safeguards.

---

## 📝 Code Style & Conventions

- **TypeScript**: Use strict typing. Avoid `any` where possible.
- **Components**: Functional components using hooks. Keep state localized to prevent unnecessary re-renders.
- **Styles**: Use the established design system tokens in `src/index.css` and Tailwind utility classes.
- **Python / ML**: Adhere to PEP 8. Maintain clear type hints in FastAPI route definitions and feature extraction pipelines.
- **Security**:
  - Never commit `.env` files or API secrets.
  - Never disable server-side authorization checks in Cloud Functions.
  - Maintain the 50 MB audio upload safety limit.

---

## 🔄 Pull Request Guidelines

1. Fork the repository and create a feature branch (`git checkout -b feature/your-feature-name`).
2. Keep commits atomic with descriptive commit messages.
3. Verify that `npm run typecheck` and `npm run build` succeed without errors.
4. Ensure all documentation files reflect any new architectural capabilities.
5. Submit the pull request with a concise summary of changes and test evidence.
