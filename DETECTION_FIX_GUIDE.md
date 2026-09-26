# 🔬 VoxForensics Audio Detection & Machine Learning Architecture

## Overview & Architecture Evolution

This document details the audio detection architecture of VoxForensics, explaining the transition from initial client-side DSP heuristics to the current production **Random Forest Machine Learning Backend**, and clarifying the current role of each subsystem.

---

## 🤖 The Current Primary Detection Engine: Random Forest ML Backend

In the current VoxForensics implementation, deepfake audio classification is performed by a dedicated **Machine Learning Backend** running on Python and FastAPI.

### Architecture Overview

```
Frontend (React / TypeScript)
     │
     │ 1. Multipart Audio Upload (POST /predict)
     ▼
FastAPI Server (ml/api.py :8000)
     │
     │ 2. Audio Validation & Audio Normalization (16kHz mono via FFmpeg)
     ▼
Feature Extractor (ml/predict.py)
     │
     │ 3. 45 Extracted Acoustic Features (librosa, soundfile)
     ▼
Random Forest Model (ml/models/deepfake_detector.joblib)
     │
     │ 4. Ensemble Decision Tree Classification
     ▼
Inference Response (JSON)
     │ - prediction: "REAL" | "FAKE"
     │ - confidence: 0.0 - 1.0
     │ - probabilities: { "real": float, "fake": float }
     │ - acoustic_features: { ... }
     ▼
Frontend Results Display & PDF Report
```

---

## 📁 Key ML Components in the Repository

1. **`ml/api.py`**:
   - Built with **FastAPI** and **Uvicorn**.
   - Exposes `POST /predict`, accepting an audio file upload (`UploadFile = File(...)`).
   - Handles temporary file streaming, invokes feature extraction and inference, and returns structured JSON responses.
   - Provides OpenAPI/Swagger documentation at `/docs`.

2. **`ml/predict.py`**:
   - Contains audio preprocessing and 45-feature acoustic extraction using `librosa` and `soundfile`.
   - Normalizes audio sample rates to 16,000 Hz mono.
   - Extracts:
     - 13 Mel-Frequency Cepstral Coefficients (MFCCs 1-13) with means and standard deviations (26 features).
     - Spectral Centroid, Rolloff, Bandwidth, and Flatness means & stds (8 features).
     - Zero-Crossing Rate (ZCR) and RMS Energy means & stds (4 features).
     - Chroma mean & std, and Tempo (3 features).
     - Pitch (Fundamental Frequency $F_0$) statistics (mean, std, min, max) (4 features).
   - Loads the serialized model via `joblib.load()` and evaluates input feature vectors.

3. **`ml/models/deepfake_detector.joblib`**:
   - Serialized scikit-learn Random Forest Classifier trained on authenticated human voice recordings and synthetic AI voice clones.
   - Evaluates input feature vectors across decision trees to calculate real vs. synthetic class probabilities.

4. **`ml/.venv`**:
   - Isolated Python virtual environment containing required runtime dependencies (`fastapi`, `uvicorn`, `librosa`, `soundfile`, `scikit-learn`, `joblib`, `numpy`, `scipy`).

---

## 🚀 How to Run the ML API Locally

From the root of the `Voxforensics2-1` repository:

```powershell
# 1. Activate the Python virtual environment (Windows PowerShell)
.\ml\.venv\Scripts\Activate.ps1

# 2. Start the FastAPI server using Uvicorn
python -m uvicorn ml.api:app --reload --port 8000
```

Once running:
- API endpoint: `http://127.0.0.1:8000/predict`
- Interactive Swagger documentation: `http://127.0.0.1:8000/docs`
- Health/Root endpoint: `http://127.0.0.1:8000/`

---

## 🛠️ Status of Client-Side DSP Code (`src/utils/analysis.ts`)

### Historical Context
Earlier prototypes of VoxForensics explored client-side Web Audio API signal processing and heuristic threshold checks (evaluating pitch variability, formant stability, and spectral flatness entirely in JavaScript). 

### Current Status in the Codebase
- The 4,600+ lines in `src/utils/analysis.ts` represent this **historical client-side heuristic DSP engine**.
- It is retained in the repository as a legacy fallback and reference implementation for local audio waveform metrics.
- **The active, primary detection engine for all production scans (Home, Scanner, and Batch tabs) is the Random Forest ML API (`ml/api.py`)**. The frontend dispatches audio files to `http://127.0.0.1:8000/predict` to obtain genuine machine learning inferences and probability scores.

---

## 📊 Key Acoustic Features Analyzed by the Model

| Feature | Description | Real Voice Characteristics | Synthetic / AI Voice Characteristics |
| :--- | :--- | :--- | :--- |
| **Pitch Variability** | Standard deviation of fundamental frequency ($F_0$) | Natural modulation, expressive pitch contours | Unnaturally flat contours or repetitive pitch micro-tremors |
| **Formant Stability** | Consistency of vocal tract resonances ($F_1, F_2, F_3$) | Dynamic shifting reflecting natural phoneme transitions | Unnatural over-smoothing across phonetic transitions |
| **Spectral Flatness** | Ratio of geometric to arithmetic mean of power spectrum | Harmonic peaks with natural tonal breathiness | Higher noise-floor artifacts from neural vocoders |
| **Harmonic Ratio (HNR)** | Ratio of periodic sound energy to non-periodic noise | High harmonicity during voiced speech | Periodic degradation and synthetic phase incoherence |
| **Spectral Centroid** | Center of mass of the frequency spectrum | Balanced distribution across vocal bands | Unnatural high-frequency energy spikes or steep rolloff |
| **MFCCs (1–13)** | Compact representation of the spectral envelope | Smooth phonetic contours | Subtle coefficient clustering characteristic of AI synthesis |

---

## ☁️ Production Deployment & Cloud Run Integration

The VoxForensics Machine Learning backend is configured for both local development and production cloud execution:

1. **Google Cloud Run Deployment**:
   - The FastAPI service is containerized via `ml/Dockerfile` using `python:3.10-slim` with `ffmpeg` installed.
   - Deployed on **Google Cloud Run**: `https://voxforensics-ml-220640941248.us-central1.run.app`.
   - Automatically handles HTTPS termination, auto-scaling, and container lifecycle.

2. **Frontend Dynamic API Binding**:
   - The React frontend dynamically resolves the ML API base URL via `import.meta.env.VITE_ML_API_URL`:
     ```typescript
     const endpoint = `${import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000'}/predict`;
     ```
   - In production, `.env.production` sets `VITE_ML_API_URL=https://voxforensics-ml-220640941248.us-central1.run.app`.
   - In local development, defaults to `http://127.0.0.1:8000` (documented in `.env.example`).
