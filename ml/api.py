
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import os
import shutil
import tempfile
import subprocess
import joblib
import pandas as pd

from ml.predict import extract_features


# ========================================
# VoxForensics — ML Prediction API
# ========================================

app = FastAPI(
    title="VoxForensics ML API",
    description="Deepfake audio detection API",
    version="1.0.0"
)


# Allow the React frontend to communicate
# with the Python backend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


MODEL_FILE = os.path.join(
    os.path.dirname(__file__),
    "models",
    "deepfake_detector.joblib"
)


# Load model once when the API starts.
try:
    model = joblib.load(MODEL_FILE)
    print("VoxForensics ML model loaded successfully.")
except Exception as error:
    model = None
    print("ERROR loading ML model:", error)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VoxForensics ML API"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None
    }


@app.post("/predict")
async def predict_audio(
    file: UploadFile = File(...)
):

    if model is None:
        raise HTTPException(
            status_code=500,
            detail="ML model is not loaded."
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No audio file provided."
        )

    # Create temporary file.
    suffix = os.path.splitext(
        file.filename
    )[1]

    temp_path = None
    converted_path = None

    try:

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_path = temp_file.name

            shutil.copyfileobj(
                file.file,
                temp_file
            )

        print()
        print("========================================")
        print(" VoxForensics — API Prediction")
        print("========================================")
        print()
        print("Received:", file.filename)

        # Convert WebM to temporary WAV via FFmpeg if necessary
        audio_path = temp_path
        is_webm = (
            suffix.lower() == ".webm"
            or file.filename.lower().endswith(".webm")
            or (file.content_type and "webm" in file.content_type.lower())
        )

        if is_webm:
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".wav"
            ) as conv_file:
                converted_path = conv_file.name

            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                temp_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                converted_path
            ]

            try:
                conversion_result = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=False
                )
            except Exception as sub_err:
                raise HTTPException(
                    status_code=500,
                    detail=f"FFmpeg execution failed: {str(sub_err)}"
                )

            if conversion_result.returncode != 0:
                print("FFmpeg conversion failed:", conversion_result.stderr)
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio conversion failed: {conversion_result.stderr.strip()[-300:]}"
                )

            audio_path = converted_path

        # Extract the same 45 features used
        # during model training.
        features = extract_features(
            audio_path
        )

        X = pd.DataFrame(
            [features]
        )

        # Make prediction.
        prediction = model.predict(
            X
        )[0]

        probabilities = model.predict_proba(
            X
        )[0]

        real_probability = float(
            probabilities[0]
        )

        fake_probability = float(
            probabilities[1]
        )

        if prediction == 0:

            verdict = "Real Voice"

        else:

            verdict = "AI-Generated / Fake"

        print()
        print("Verdict:", verdict)
        print(
            f"Real probability: {real_probability * 100:.2f}%"
        )
        print(
            f"Fake probability: {fake_probability * 100:.2f}%"
        )
        print()

        return {
            "success": True,
            "filename": file.filename,
            "verdict": verdict,
            "real_probability": round(
                real_probability * 100,
                2
            ),
            "fake_probability": round(
                fake_probability * 100,
                2
            ),
            "features": {
                "rmsEnergy": features["rms_mean"],
                "pitchMean": features["pitch_mean"],
                "spectralCentroid": features[
                    "spectral_centroid_mean"
                ],
                "zeroCrossingRate": features[
                    "zero_crossing_rate_mean"
                ]
            }
        }

    except HTTPException:
        raise

    except Exception as error:

        print()
        print("Prediction error:", error)

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        for path in (temp_path, converted_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as cleanup_err:
                    print("Warning: Failed to remove temporary file:", path, cleanup_err)

