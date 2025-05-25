#!/bin/bash

# LLM UI Build Script for Linux Packaging

echo "🚀 Starting LLM UI build process..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Build for Linux
echo "🔨 Building Linux packages..."
npm run dist:linux

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📦 Packages created in dist/ directory:"
    ls -la dist/
else
    echo "❌ Build failed!"
    exit 1
fi