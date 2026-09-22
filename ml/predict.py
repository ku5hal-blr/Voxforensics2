import sys
import os
import joblib
import librosa
import numpy as np
import pandas as pd


# ========================================
# VoxForensics — ML Prediction
# ========================================

MODEL_FILE = "ml/models/deepfake_detector.joblib"


# ========================================
# Feature Extraction
# ========================================

def extract_features(audio_file):

    print("Loading audio...")

    y, sample_rate = librosa.load(
        audio_file,
        sr=None,
        mono=True
    )

    y = np.asarray(
        y,
        dtype=np.float32
    )

    y = np.nan_to_num(y)

    max_value = np.max(
        np.abs(y)
    )

    if max_value > 0:
        y = y / max_value

    features = {}

    # ========================================
    # MFCC
    # ========================================

    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sample_rate,
        n_mfcc=13
    )

    for i in range(13):

        features[f"mfcc_{i+1}_mean"] = float(
            np.mean(mfcc[i])
        )

        features[f"mfcc_{i+1}_std"] = float(
            np.std(mfcc[i])
        )

    # ========================================
    # Spectral Features
    # ========================================

    spectral_centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=sample_rate
    )

    spectral_rolloff = librosa.feature.spectral_rolloff(
        y=y,
        sr=sample_rate
    )

    spectral_bandwidth = librosa.feature.spectral_bandwidth(
        y=y,
        sr=sample_rate
    )

    spectral_flatness = librosa.feature.spectral_flatness(
        y=y
    )

    features["spectral_centroid_mean"] = float(
        np.mean(spectral_centroid)
    )

    features["spectral_centroid_std"] = float(
        np.std(spectral_centroid)
    )

    features["spectral_rolloff_mean"] = float(
        np.mean(spectral_rolloff)
    )

    features["spectral_rolloff_std"] = float(
        np.std(spectral_rolloff)
    )

    features["spectral_bandwidth_mean"] = float(
        np.mean(spectral_bandwidth)
    )

    features["spectral_bandwidth_std"] = float(
        np.std(spectral_bandwidth)
    )

    features["spectral_flatness_mean"] = float(
        np.mean(spectral_flatness)
    )

    features["spectral_flatness_std"] = float(
        np.std(spectral_flatness)
    )

    # ========================================
    # Zero Crossing Rate
    # ========================================

    zero_crossing_rate = librosa.feature.zero_crossing_rate(
        y
    )

    features["zero_crossing_rate_mean"] = float(
        np.mean(zero_crossing_rate)
    )

    features["zero_crossing_rate_std"] = float(
        np.std(zero_crossing_rate)
    )

    # ========================================
    # RMS Energy
    # ========================================

    rms = librosa.feature.rms(
        y=y
    )

    features["rms_mean"] = float(
        np.mean(rms)
    )

    features["rms_std"] = float(
        np.std(rms)
    )

    # ========================================
    # Chroma
    # ========================================

    chroma = librosa.feature.chroma_stft(
        y=y,
        sr=sample_rate
    )

    features["chroma_mean"] = float(
        np.mean(chroma)
    )

    features["chroma_std"] = float(
        np.std(chroma)
    )

    # ========================================
    # Tempo
    # ========================================

    tempo, _ = librosa.beat.beat_track(
        y=y,
        sr=sample_rate
    )

    features["tempo"] = float(
        np.asarray(tempo).flatten()[0]
    )

    # ========================================
    # Pitch
    # ========================================

    try:

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=70,
            fmax=500,
            sr=sample_rate
        )

        valid_pitch = f0[
            ~np.isnan(f0)
        ]

        if len(valid_pitch) > 0:

            features["pitch_mean"] = float(
                np.mean(valid_pitch)
            )

            features["pitch_std"] = float(
                np.std(valid_pitch)
            )

            features["pitch_min"] = float(
                np.min(valid_pitch)
            )

            features["pitch_max"] = float(
                np.max(valid_pitch)
            )

        else:

            features["pitch_mean"] = 0.0
            features["pitch_std"] = 0.0
            features["pitch_min"] = 0.0
            features["pitch_max"] = 0.0

    except Exception:

        features["pitch_mean"] = 0.0
        features["pitch_std"] = 0.0
        features["pitch_min"] = 0.0
        features["pitch_max"] = 0.0

    return features


# ========================================
# Command-Line Prediction
# ========================================

def main():

    if len(sys.argv) < 2:

        print()
        print("Usage:")
        print("python ml/predict.py <audio_file>")
        print()

        sys.exit(1)

    audio_file = sys.argv[1]

    if not os.path.exists(audio_file):

        print()
        print("ERROR: Audio file not found.")
        print(audio_file)
        print()

        sys.exit(1)

    if not os.path.exists(MODEL_FILE):

        print()
        print("ERROR: Trained model not found.")
        print(MODEL_FILE)
        print()

        sys.exit(1)

    print()
    print("========================================")
    print(" VoxForensics — ML Audio Prediction")
    print("========================================")
    print()

    print("Audio file:", audio_file)
    print()

    print("Loading trained model...")

    model = joblib.load(
        MODEL_FILE
    )

    print("Model loaded.")
    print()

    features = extract_features(
        audio_file
    )

    print("Feature extraction complete.")
    print()

    X = pd.DataFrame(
        [features]
    )

    prediction = model.predict(
        X
    )[0]

    probabilities = model.predict_proba(
        X
    )[0]

    real_probability = probabilities[0]
    fake_probability = probabilities[1]

    print("========================================")
    print(" Analysis Result")
    print("========================================")
    print()

    if prediction == 0:

        print("VERDICT: REAL VOICE")

    else:

        print("VERDICT: AI-GENERATED / FAKE")

    print()

    print(
        f"Real probability: {real_probability * 100:.2f}%"
    )

    print(
        f"Fake probability: {fake_probability * 100:.2f}%"
    )

    print()

    print("========================================")
    print(" Prediction complete")
    print("========================================")


# ========================================
# Important:
# Only run main() when this file is
# executed directly.
#
# FastAPI can now safely import
# extract_features() without triggering
# command-line prediction.
# ========================================

if __name__ == "__main__":

    main()