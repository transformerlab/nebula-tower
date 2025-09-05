#!/bin/bash

# Development run script for Nebula Tower Menubar App

echo "Starting Nebula Tower Menubar App in development mode..."

# Check if tray icon exists
if [ ! -f "icons/trayIcon.png" ]; then
    echo "Warning: icons/trayIcon.png not found. App will use fallback icon."
fi

# Ensure dependencies are up to date
go mod tidy

# Run the main application
echo "Starting main application..."
go run *.go
