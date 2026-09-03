FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    CMAKE_BUILD_PARALLEL_LEVEL=1 \
    CMAKE_ARGS="-DDLIB_NO_GUI_SUPPORT=ON -DDLIB_USE_CUDA=OFF"

# 1. ติดตั้ง C++ Build Tools และ Library พื้นฐาน
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# 2. ติดตั้ง Python Libraries
RUN pip install --no-cache-dir "setuptools<70" wheel
RUN pip install --no-cache-dir -r requirements.txt

# 3. ติดตั้ง dlib แบบจำกัด 1 Core และปิด GUI ผ่าน CMAKE_ARGS
RUN CMAKE_BUILD_PARALLEL_LEVEL=1 \
    CMAKE_ARGS="-DDLIB_NO_GUI_SUPPORT=ON -DDLIB_USE_CUDA=OFF" \
    pip install --no-cache-dir dlib

# 4. ติดตั้ง face_recognition
RUN pip install --no-cache-dir dlib face_recognition psycopg2-binary

COPY . .

CMD ["sh", "-c", "python -m uvicorn api:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]