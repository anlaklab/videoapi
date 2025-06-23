#!/bin/bash

# JSON2VIDEO API Setup Script

echo "🎬 JSON2VIDEO API Setup"
echo "======================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16.0.0 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

# Simple version comparison without semver dependency
version_compare() {
    local version1=$1
    local version2=$2
    
    # Convert versions to comparable numbers
    local v1_major=$(echo $version1 | cut -d'.' -f1)
    local v1_minor=$(echo $version1 | cut -d'.' -f2)
    local v1_patch=$(echo $version1 | cut -d'.' -f3)
    
    local v2_major=$(echo $version2 | cut -d'.' -f1)
    local v2_minor=$(echo $version2 | cut -d'.' -f2)
    local v2_patch=$(echo $version2 | cut -d'.' -f3)
    
    # Compare major version
    if [ "$v1_major" -gt "$v2_major" ]; then
        return 0
    elif [ "$v1_major" -lt "$v2_major" ]; then
        return 1
    fi
    
    # Compare minor version
    if [ "$v1_minor" -gt "$v2_minor" ]; then
        return 0
    elif [ "$v1_minor" -lt "$v2_minor" ]; then
        return 1
    fi
    
    # Compare patch version
    if [ "$v1_patch" -ge "$v2_patch" ]; then
        return 0
    else
        return 1
    fi
}

if ! version_compare "$NODE_VERSION" "$REQUIRED_VERSION"; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install version $REQUIRED_VERSION or higher."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed."
    echo "Please install FFmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu/Debian: sudo apt install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

echo "✅ FFmpeg detected: $(ffmpeg -version | head -n1)"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p temp
mkdir -p output
mkdir -p assets/images
mkdir -p assets/videos
mkdir -p assets/audio
mkdir -p assets/fonts
mkdir -p assets/general
mkdir -p logs
mkdir -p data

echo "✅ Directories created"

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "❌ package.json not found"
    exit 1
fi

# Copy environment file if it doesn't exist
if [ ! -f ".env" ] && [ -f "env.example" ]; then
    echo "⚙️ Creating .env file from example..."
    cp env.example .env
    echo "✅ .env file created. Please review and adjust settings as needed."
fi

# Set permissions for scripts
chmod +x scripts/*.sh 2>/dev/null || true

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "For development:"
echo "  npm run dev"
echo ""
echo "API will be available at: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo "API docs: http://localhost:3000/api/docs" 