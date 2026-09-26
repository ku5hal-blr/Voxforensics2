# Use official Python 3.11 slim base image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output for Cloud Run logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8080

# Install system dependencies required by libsndfile / librosa and audio conversion (FFmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory to /app
WORKDIR /app

# Install Python production dependencies
COPY ml/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy ML application code and the trained model into /app/ml
COPY ml/ /app/ml/

# Expose default Cloud Run port
EXPOSE 8080

# Start Uvicorn ASGI server with Cloud Run PORT support
CMD ["sh", "-c", "exec uvicorn ml.api:app --host 0.0.0.0 --port ${PORT}"]
