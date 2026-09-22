from datasets import load_dataset

print("========================================")
print(" VoxForensics ML Dataset Downloader")
print("========================================")
print()
print("Starting dataset download...")
print("Please wait. The dataset is approximately 1.16 GB.")
print()

dataset = load_dataset(
    "garystafford/deepfake-audio-detection"
)

print()
print("========================================")
print(" Dataset download complete!")
print("========================================")

print(dataset)

train = dataset["train"]

print()
print("Total samples:", len(train))
print("Columns:", train.column_names)

real_count = sum(1 for item in train if item["label"] == 0)
fake_count = sum(1 for item in train if item["label"] == 1)

print("Real samples:", real_count)
print("Fake samples:", fake_count)