# Nebula Tower Menubar App - Fyne Version

## Overview

This is a native menubar/system tray application for Nebula Tower built with [Fyne](https://fyne.io/), a cross-platform GUI toolkit for Go. 

## Changes Made

### ✅ What was fixed:
- **Removed duplicate system tray implementation**: Removed `github.com/getlantern/systray` dependency
- **Native Fyne system tray**: Now uses Fyne's built-in `desktop.App` system tray functionality
- **Improved settings UI**: Native Fyne settings window with better organization and user feedback
- **Better error handling**: Proper status messages in the settings window
- **Enhanced security**: Invite code is now masked in the settings interface
- **Graceful shutdown**: Proper signal handling and app lifecycle management

### 🏗️ Architecture:
- **main.go**: Updated to use Fyne's native system tray
- **icon.go**: Unchanged, still handles icon loading
- **build-fyne.sh**: New build script for the Fyne version

## Building

### Quick Build
```bash
./build-fyne.sh
```

### Manual Build
```bash
go build -o nebula-tower-fyne main.go icon.go
```

## Running

```bash
./nebula-tower-fyne
```

The app will:
1. Load configuration from the platform-specific config directory
2. Create a system tray icon with menu
3. Provide access to settings, debug info, and Nebula service controls

## System Tray Menu

- **Start Nebula**: Start the Nebula VPN service (placeholder implementation)
- **Settings**: Open the settings window to configure Tower IP and invite code
- **Debug Log**: View system information and configuration details
- **Quit**: Exit the application

## Configuration

Configuration is stored in:
- **macOS**: `~/Library/Application Support/Nebula Tower/config.json`
- **Linux**: `~/.config/nebula-tower/config.json`
- **Windows**: `%APPDATA%\Nebula Tower\config.json`

## Features

### Settings Window
- Clean, native Fyne UI
- Tower IP configuration
- Invite code management (masked for security)
- Real-time save feedback
- Prevents multiple settings windows

### Debug Information
- System information display
- Configuration file location
- Process details
- Native Fyne dialog presentation

## Dependencies

- [Fyne v2](https://fyne.io/): Cross-platform GUI toolkit
- Standard Go libraries

## Platform Support

- ✅ macOS (tested)
- ✅ Linux (supported by Fyne)
- ✅ Windows (supported by Fyne)
