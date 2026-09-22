from datasets import load_dataset
import librosa
import numpy as np
import pandas as pd
from tqdm import tqdm


# ============================================================
# VoxForensics — Audio Feature Extraction
# ============================================================

print("========================================")
print(" VoxForensics Feature Extraction")
print("========================================")
print()

print("Loading dataset...")
dataset = load_dataset("garystafford/deepfake-audio-detection")

train = dataset["train"]

print(f"Dataset loaded: {len(train)} samples")
print()


def extract_features(audio_array, sample_rate):
    """
    Extract acoustic and spectral features from one audio sample.
    """

    # Convert to numpy array
    y = np.asarray(audio_array, dtype=np.float32)

    # Remove invalid values
    y = np.nan_to_num(y)

    # Normalize audio
    max_value = np.max(np.abs(y))

    if max_value > 0:
        y = y / max_value

    features = {}

    # --------------------------------------------------------
    # 1. MFCC FEATURES
    # --------------------------------------------------------

    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sample_rate,
        n_mfcc=13
    )

    for i in range(13):
        features[f"mfcc_{i+1}_mean"] = float(np.mean(mfcc[i]))
        features[f"mfcc_{i+1}_std"] = float(np.std(mfcc[i]))

    # --------------------------------------------------------
    # 2. SPECTRAL FEATURES
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # 3. ZERO CROSSING RATE
    # --------------------------------------------------------

    zero_crossing_rate = librosa.feature.zero_crossing_rate(y)

    features["zero_crossing_rate_mean"] = float(
        np.mean(zero_crossing_rate)
    )

    features["zero_crossing_rate_std"] = float(
        np.std(zero_crossing_rate)
    )

    # --------------------------------------------------------
    # 4. RMS ENERGY
    # --------------------------------------------------------

    rms = librosa.feature.rms(y=y)

    features["rms_mean"] = float(
        np.mean(rms)
    )

    features["rms_std"] = float(
        np.std(rms)
    )

    # --------------------------------------------------------
    # 5. CHROMA
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # 6. TEMPO
    # --------------------------------------------------------

    tempo, _ = librosa.beat.beat_track(
        y=y,
        sr=sample_rate
    )

    features["tempo"] = float(
        np.asarray(tempo).flatten()[0]
    )

    # --------------------------------------------------------
    # 7. PITCH
    # --------------------------------------------------------

    try:

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=70,
            fmax=500,
            sr=sample_rate
        )

        valid_pitch = f0[~np.isnan(f0)]

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


# ============================================================
# Process Dataset
# ============================================================

rows = []

print("Extracting audio features...")
print()

for index in tqdm(range(len(train))):

    try:

        item = train[index]

        audio = item["audio"]

        features = extract_features(
            audio["array"],
            audio["sampling_rate"]
        )

        # Dataset label
        features["label"] = int(item["label"])

        # Keep sample number for reference
        features["sample_id"] = index

        rows.append(features)

    except Exception as error:

        print()
        print(f"Error processing sample {index}: {error}")
        print()


# ============================================================
# Save Features
# ============================================================

print()
print("Creating feature table...")

df = pd.DataFrame(rows)

# Put sample_id and label at the beginning
columns = ["sample_id", "label"]

remaining_columns = [
    column for column in df.columns
    if column not in columns
]

df = df[columns + remaining_columns]

output_file = "ml/features.csv"

df.to_csv(
    output_file,
    index=False
)

print()
print("========================================")
print(" Feature extraction complete!")
print("========================================")
print()
print("Samples processed:", len(df))
print("Number of features:", len(df.columns) - 2)
print()
print("Output file:")
print(output_file)
print()

print("Label distribution:")

print(
    df["label"].value_counts().sort_index()
)

print()
print("Feature file saved successfully.")