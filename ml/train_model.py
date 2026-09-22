import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)


# ============================================================
# VoxForensics — Random Forest Training
# ============================================================

print("========================================")
print(" VoxForensics — ML Model Training")
print("========================================")
print()


# ============================================================
# 1. Load Feature Dataset
# ============================================================

print("Loading feature dataset...")

df = pd.read_csv("ml/features.csv")

print(f"Dataset loaded: {len(df)} samples")
print()


# ============================================================
# 2. Prepare Features and Labels
# ============================================================

# sample_id is only an identifier.
# It must NOT be used as a machine-learning feature.

X = df.drop(
    columns=["sample_id", "label"]
)

y = df["label"]


print("Features:", X.shape[1])
print("Samples:", X.shape[0])
print()


# ============================================================
# 3. Train/Test Split
# ============================================================

print("Splitting dataset...")

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("Training samples:", len(X_train))
print("Testing samples:", len(X_test))
print()


# ============================================================
# 4. Create Random Forest Model
# ============================================================

print("Creating Random Forest model...")

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=None,
    random_state=42,
    n_jobs=-1,
    class_weight="balanced"
)

print("Model created.")
print()


# ============================================================
# 5. Train Model
# ============================================================

print("Training model...")
print("Please wait...")
print()

model.fit(
    X_train,
    y_train
)

print("Training complete!")
print()


# ============================================================
# 6. Make Predictions
# ============================================================

print("Testing model...")

y_pred = model.predict(X_test)


# ============================================================
# 7. Calculate Performance Metrics
# ============================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

precision = precision_score(
    y_test,
    y_pred,
    zero_division=0
)

recall = recall_score(
    y_test,
    y_pred,
    zero_division=0
)

f1 = f1_score(
    y_test,
    y_pred,
    zero_division=0
)

cm = confusion_matrix(
    y_test,
    y_pred
)


# ============================================================
# 8. Display Results
# ============================================================

print()
print("========================================")
print(" Model Evaluation")
print("========================================")
print()

print(f"Accuracy : {accuracy * 100:.2f}%")
print(f"Precision: {precision * 100:.2f}%")
print(f"Recall   : {recall * 100:.2f}%")
print(f"F1 Score : {f1 * 100:.2f}%")

print()

print("Confusion Matrix:")
print(cm)

print()

print("Classification Report:")
print(
    classification_report(
        y_test,
        y_pred,
        target_names=[
            "Real",
            "Fake"
        ],
        zero_division=0
    )
)


# ============================================================
# 9. Save Model
# ============================================================

model_directory = "ml/models"

os.makedirs(
    model_directory,
    exist_ok=True
)

model_file = (
    "ml/models/"
    "deepfake_detector.joblib"
)

joblib.dump(
    model,
    model_file
)


# ============================================================
# 10. Final Information
# ============================================================

print()
print("========================================")
print(" Model Saved Successfully!")
print("========================================")
print()

print("Model file:")
print(model_file)

print()
print("Training samples:", len(X_train))
print("Testing samples :", len(X_test))

print()
print("VoxForensics ML training complete.")