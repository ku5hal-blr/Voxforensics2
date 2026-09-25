# 🎨 VoxForensics UI Architecture & Design Guide

## 📋 Overview

VoxForensics features a modern visual design system tailored for forensic audio analysis:
- **Dark Theme**: Deep space dark aesthetic with high-contrast text.
- **Glassmorphic Cards**: Semi-transparent panels with backdrop blur and subtle border glow.
- **Neon Accents**: Cyan (`#00d4ff`), Purple (`#a855f7`), Green (`#00ff88`), and Red (`#ef4444`).
- **Interactive Navigation**: Header tabs for Home, Scanner, Batch Processing, Scan History, and About.
- **Role-Aware Header**: Shows authenticated user profile, Admin/User badge, Dashboard link, and Logout button.

---

## 🎯 Design Tokens & Color Palette

```css
--dark: #050914;          /* Main viewport background */
--panel: #0a1128;         /* Glassmorphic card background */
--panel-border: #1a2a4a;  /* Subtle card borders */
--neon-cyan: #00d4ff;     /* Primary actions & branding */
--neon-purple: #a855f7;   /* Synthetic / Deepfake indicator */
--neon-green: #00ff88;    /* Authentic / Real indicator */
--neon-red: #ef4444;      /* Destructive actions & threat alerts */
```

---

## 🚀 Key User Interface Modules

### 1. Authentication Portal (`src/components/AuthSystem.tsx`)
- **Centered Modal**: Sleek glassmorphic card for Login and Registration.
- **Password Visibility Toggle**: Interactive eye icon (`Eye` / `EyeOff`) allowing users to reveal or mask passwords.
- **Email Verification Notice**: Informs users when a verification link has been dispatched to their inbox.
- **Email OTP Input**: Clean 6-digit PIN input with resend countdown timer and attempt indicator.
- **Role Routing**: Automatically routes administrators to admin capabilities and standard users to user views.

### 2. Header & User Navigation Bar (`src/App.tsx`)
- **Brand Identity**: VoxForensics logo with glowing neon waveform icon.
- **Top Navigation Tabs**:
  - `Home`: Hero overview with quick upload, record, and sample demo buttons.
  - `Scanner`: Full forensic analysis interface with waveform and acoustic parameters.
  - `Batch`: Multi-file queuing, sequential analysis, and bulk report generation.
  - `History`: Persistent log of past scans with search and deletion controls.
  - `About`: Technical methodology, privacy information, and compliance details.
- **User Profile Pill**: Displays user name, role badge (`Admin` / `User`), **"👤 Dashboard"** button, and **"🚪 Logout"** button.

### 3. Audio Scanner & Results Panel
- **File Dropzone**: Drag-and-drop or file selector accepting WAV, MP3, OGG, FLAC, M4A up to 50 MB.
- **Microphone Recorder**: Start/Stop button with pulsating red recording indicator, timer, and animated waveform bars.
- **Waveform Canvas**: Canvas-rendered audio amplitude graph matching the verdict color scheme.
- **Verdict Banner**: Bold authentic (`REAL VOICE`) or synthetic (`AI-GENERATED VOICE`) banner with confidence percentage.
- **Probability Bars**: Dual distribution bars showing exact real vs. fake model probabilities.
- **Acoustic Metric Grid**: 2x2 or 4x1 responsive grid showing MFCCs, Spectral Centroid, Pitch Variability, and Zero-Crossing Rate.
- **Forensic PDF Export**: Prominent **"Download PDF"** button generating an evidentiary report with embedded waveform graphics.

### 4. Batch Processing Queue (`src/components/BatchProcessing.tsx`)
- **Multi-File Dropzone**: Queue multiple audio files simultaneously.
- **Live Progress**: Progress bar tracking queue completion percentage and active filename.
- **Results Table**:
  - Filename, file size, audio duration.
  - Color-coded verdict badge (Authentic / Synthetic).
  - Confidence percentage.
  - Per-item **"PDF"** button to download individual forensic reports.

### 5. Dashboards
- **User Dashboard (`src/components/UserDashboard.tsx`)**:
  - Scan statistics (total scans, deepfakes detected).
  - Referral program card with one-click referral code copy button.
  - Security settings & 2FA status indicator.
  - Recent scan history log.
- **Admin Dashboard (`src/components/AdminDashboard.tsx`)**:
  - Platform statistics (total users, admin count, 2FA adoption rate).
  - User management table with promote/demote role toggles.
  - Secure deletion button triggering the `deleteUserAccount` Cloud Function.

### 6. Legal Consent Modal (`src/components/ConsentModal.tsx`)
- Displays on initial login.
- Single confirmation checkbox required to enable the **"I Agree"** button.
- Expandable sections for Voice Data Usage, Privacy Policy, Terms of Service, and Data Storage.
