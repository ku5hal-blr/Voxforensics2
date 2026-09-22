import pandas as pd
import numpy as np


print("========================================")
print(" VoxForensics — Feature Quality Check")
print("========================================")
print()

# Load feature file
df = pd.read_csv("ml/features.csv")

print("Rows:", len(df))
print("Columns:", len(df.columns))
print()

# ------------------------------------------------------------
# Check missing values
# ------------------------------------------------------------

missing = df.isnull().sum()
total_missing = missing.sum()

print("Missing values:", total_missing)

if total_missing > 0:
    print()
    print("Columns with missing values:")

    print(
        missing[missing > 0]
    )

else:
    print("No missing values found.")

print()

# ------------------------------------------------------------
# Check infinite values
# ------------------------------------------------------------

numeric_df = df.select_dtypes(include=[np.number])

infinite_values = np.isinf(
    numeric_df.to_numpy()
).sum()

print("Infinite values:", infinite_values)

print()

# ------------------------------------------------------------
# Check labels
# ------------------------------------------------------------

print("Label distribution:")
print(df["label"].value_counts().sort_index())

print()

# ------------------------------------------------------------
# Final result
# ------------------------------------------------------------

if total_missing == 0 and infinite_values == 0:

    print("========================================")
    print(" Feature quality check PASSED")
    print("========================================")

else:

    print("========================================")
    print(" Feature quality check FOUND ISSUES")
    print("========================================")