#!/bin/bash

# Build script for Nebula Tower Menubar App using Fyne

set -e

APP_NAME="nebula-tower-menubar"
ICON="icon.png"
TRAY_ICON="icons/trayIcon.png"
BUNDLE_FILE="bundled.go"
VERSION="1.0.0"

echo "Building Nebula Tower Menubar App v$VERSION using Fyne..."

# Clean previous builds
rm -rf build/
mkdir -p build/

# Bundle resources
if [ -f "$ICON" ]; then
    echo "Bundling main icon..."
    fyne bundle -o $BUNDLE_FILE $ICON
else
    echo "Error: Main icon file $ICON not found. Exiting."
    exit 1
fi

if [ -f "$TRAY_ICON" ]; then
    echo "Bundling tray icon..."
    fyne bundle -o $BUNDLE_FILE -append $TRAY_ICON
else
    echo "Error: Tray icon file $TRAY_ICON not found. Exiting."
    exit 1
fi

# Build for darwin
OUTPUT_NAME="build/${APP_NAME}-darwin"
echo "Building for darwin... to $OUTPUT_NAME"
fyne package -os darwin -icon $ICON -name build/$APP_NAME

# Cleanup bundled file
if [ -f "$BUNDLE_FILE" ]; then
    rm $BUNDLE_FILE
fi

echo "Build completed! Binaries are in the build/ directory."
echo ""
ls -la build/
