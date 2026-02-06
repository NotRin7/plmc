# Dockerfile for building Electron app for Linux and Windows
FROM node:20-slim

# Install dependencies for building native modules and electron-builder
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libusb-1.0-0-dev \
    libudev-dev \
    wine \
    wine64 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# We will mount the source code here
# To build:
# docker run --rm -v $(pwd):/app plmc-builder npm install && npm run electron:build
