# Nebula Tower Menubar App (Fyne)

A cross-platform system tray application for managing Nebula Tower VPN connections, built with Go and Fyne.

## ⚠️ Important Update

**This application has been updated to use Fyne's native system tray functionality instead of the external `github.com/getlantern/systray` package.**

- ✅ **Recommended**: Use `main.go` - Pure Fyne implementation with native system tray
- ⚠️ **Legacy**: Other main-*.go files use the old systray library (may have conflicts)

## Features

- Cross-platform system tray icon (Windows, macOS, Linux)
- Native Fyne settings window with improved UX
- Debug information viewer in native window
- Start/Stop Nebula VPN service (placeholder)
- Persistent configuration storage
- Secure invite code handling (masked input)
- Better error handling and user feedback

## Quick Start

```bash
# Build and run the Fyne version
./build-fyne.sh
./nebula-tower-fyne
```

## Prerequisites

- Go 1.21 or later
- Icon file: `icons/trayIcon.png` (will use fallback if not found)
- Platform-specific requirements:
  - **macOS**: No additional requirements
  - **Linux**: `libgl1-mesa-dev xorg-dev` (Ubuntu/Debian) or equivalent
  - **Windows**: No additional requirements

## Building

### Development
```bash
go mod tidy
go run main.go
```

### Production Build
```bash
# Build for current platform
go build -o nebula-tower-menubar

# Build for specific platforms
GOOS=windows GOARCH=amd64 go build -o nebula-tower-menubar.exe
GOOS=darwin GOARCH=amd64 go build -o nebula-tower-menubar-mac-intel
GOOS=darwin GOARCH=arm64 go build -o nebula-tower-menubar-mac-arm
GOOS=linux GOARCH=amd64 go build -o nebula-tower-menubar-linux
```

## Usage

1. Run the application - it will appear in your system tray
2. Right-click the tray icon to access the menu:
   - **Start**: Initiates the Nebula VPN connection
   - **Settings**: Opens configuration window
   - **Debug Log**: View application logs and debug information
   - **Quit**: Exit the application

### Settings

The settings window allows you to configure:
- **Tower IP**: The IP address and port of your Nebula Tower server
- **Invite Code**: Your authentication token for the Nebula network

Configuration is automatically saved to platform-appropriate locations:
- **Windows**: `%APPDATA%\Nebula Tower\config.json`
- **macOS**: `~/Library/Application Support/Nebula Tower/config.json`
- **Linux**: `~/.config/nebula-tower/config.json`

## Architecture

The application uses:
- **Fyne**: Cross-platform GUI framework for settings windows
- **Systray**: System tray integration across platforms
- **JSON**: Configuration file storage

## TODO

- [ ] Implement actual Nebula service integration
- [ ] Add real-time log monitoring
- [ ] Add connection status indicators
- [ ] Implement service start/stop functionality
- [ ] Add application auto-updater
- [ ] Custom application icon
- [ ] Network status monitoring

## License

This project follows the same license as the parent Nebula Tower project.
