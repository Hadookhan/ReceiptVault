# Use a small, stable Python base
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# System deps (optional but safe for some python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your source code
COPY . .

# Create uploads dir inside container (your code also does this at runtime)
RUN mkdir -p /app/uploads

# Expose the port your app listens on
EXPOSE 5001

# Use Gunicorn in containers (NOT flask dev server)
# app:app means "file:variable" -> app.py has variable named app
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "app:app"]
