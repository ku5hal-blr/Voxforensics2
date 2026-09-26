# How to Share VoxForensics on GitHub

This guide explains how to properly publish and share the VoxForensics project on GitHub while safeguarding sensitive files and ensuring clean repository hygiene.

---

## 🚀 Step-by-Step GitHub Setup

### Step 1: Create a GitHub Repository
1. Navigate to [https://github.com](https://github.com) and sign in.
2. Click the **"+"** icon in the upper right corner and select **"New repository"**.
3. Fill in the details:
   - **Repository name**: `voxforensics`
   - **Description**: "AI-Powered Deepfake Audio Detection & Forensic Analysis System"
   - **Visibility**: Public or Private
   - Do not initialize with README or license if importing existing code.
4. Click **"Create repository"**.

---

### Step 2: Configure `.gitignore`
Ensure the repository's `.gitignore` contains rules for all frontend, Python ML, and Cloud Function dependencies and secrets:

```gitignore
# Dependencies
node_modules/
functions/node_modules/
ml/.venv/
.venv/
__pycache__/
*.pyc

# Build output
dist/
build/
functions/lib/

# Environment variables & secrets
.env
.env.*
!.env.example
serviceAccountKey.json
*.pem

# IDE & OS files
.vscode/
.idea/
.DS_Store
Thumbs.db

# Log files
*.log
npm-debug.log*
firebase-debug.log*
firestore-debug.log*
```

---

### Step 3: Connect Local Repository & Push

In your terminal within `Voxforensics2-1`:

```bash
# Check git status
git status

# Add files to git staging
git add .

# Commit changes
git commit -m "VoxForensics: AI-Powered Deepfake Audio Detection & Forensic Analysis System"

# Point to your GitHub repository URL
git remote add origin https://github.com/YOUR_USERNAME/voxforensics.git

# Push to the main branch
git branch -M main
git push -u origin main
```

---

## 📁 Repository Structure Overview

A clean GitHub repository for VoxForensics contains:

```
Voxforensics2-1/
├── src/                     # React + TypeScript frontend
│   ├── components/          # Auth, Admin, User Dashboard, Batch, Background
│   ├── services/            # Email OTP service, Firestore history service
│   ├── utils/               # PDF generator with waveform, audio helpers
│   ├── App.tsx              # Main controller, responsive drawer & tab router
│   ├── firebase.ts          # Client Firebase SDK configuration
│   └── index.css            # Design system, responsive classes & styling
├── ml/                      # Python ML backend
│   ├── models/              # Model artifacts
│   │   └── deepfake_detector.joblib # Serialized Random Forest classifier
│   ├── .dockerignore        # Docker build ignore rules
│   ├── Dockerfile           # Cloud Run Docker container specification
│   ├── api.py               # FastAPI server & /predict endpoint
│   ├── predict.py           # 45-feature acoustic extraction pipeline
│   └── requirements.txt     # Python dependencies
├── functions/               # Firebase Cloud Functions (Node 20)
│   ├── src/index.ts         # deleteUserAccount callable function
│   └── package.json         # Cloud Functions dependencies
├── .env.example             # Environment template (VITE_ML_API_URL)
├── firebase.json            # Firebase Hosting, Functions & Firestore config
├── firestore.rules          # Firestore database security rules
├── package.json             # Frontend npm dependencies & build scripts
├── vite.config.js           # Vite build configuration
└── README.md                # Main repository documentation
```

---

## 🔒 Security Best Practices Before Sharing

- ✅ **No Secrets**: Verify that no API secret keys, Google Cloud service account JSON keys, or SMTP App Passwords are committed.
- ✅ **Virtual Environment**: Ensure `ml/.venv/` is excluded via `.gitignore`.
- ✅ **Node Modules**: Ensure both root `node_modules/` and `functions/node_modules/` are excluded.
- ✅ **Demo Accounts Notice**: In public repositories, ensure credentials listed in `LOGIN_CREDENTIALS.md` are marked specifically for demo/sandbox evaluation.
