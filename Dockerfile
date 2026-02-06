# Dockerfile for building Electron app for Linux and Windows
FROM node:20-slim

# Install dependencies for building native modules and electron-builder
# Adding ca-certificates to fix SSL issues when downloading electron
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libusb-1.0-0-dev \
    libudev-dev \
    wine \
    wine64 \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Fix for "certificate signed by unknown authority" in some environments
RUN update-ca-certificates

WORKDIR /app

# We will mount the source code here
# To build:
# docker run --rm -v $(pwd):/app plmc-builder npm install && npm run electron:build
