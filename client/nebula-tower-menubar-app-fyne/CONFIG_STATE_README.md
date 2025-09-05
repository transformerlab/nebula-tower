# Nebula Config State Management

This implementation adds persistent state management for nebula configuration files and controls the start button based on configuration availability.

## Features Implemented

### 1. State Persistence
- Added `nebulaConfigExists` field to the App struct to track configuration state
- Added `startMenuItem` reference to control start button state
- State is persisted in memory and checked at startup and periodically

### 2. Configuration Checking
- `checkNebulaConfig()` - Checks if all required nebula files exist:
  - `config.yaml`
  - `ca.crt` 
  - `host.crt`
  - `host.key`
- Files are checked in the same directory as the app config file

### 3. State Management Functions
- `updateNebulaConfigState()` - Updates the internal state and logs changes
- `updateStartButtonState()` - Enables/disables start button based on config state
- Includes debug logging to show config directory and state changes

### 4. Start Button Control
- Start button is initially disabled when app launches
- Gets enabled only when all required nebula config files are present
- Start function includes safety check and won't proceed without config

### 5. Automatic State Checking
- Initial check at app startup after system tray setup
- Periodic checks every 5 seconds via lighthouse pinger
- Check after config deletion in settings
- Check after invite code save (with 2-second delay for server processing)

## File Locations

The nebula config files are expected in the same directory as the app config:

- **macOS**: `~/Library/Application Support/Nebula Tower/`
- **Windows**: `%APPDATA%/Nebula Tower/`
- **Linux**: `~/.config/nebula-tower/`

## Testing

Use the provided `test_config.sh` script to test the functionality:

```bash
# Create test config files (enables start button)
./test_config.sh create

# Remove test config files (disables start button)  
./test_config.sh remove

# Check current state of config files
./test_config.sh check
```

## Integration Points

The system integrates with existing functionality:

1. **Settings UI** - Shows config status and delete option
2. **Lighthouse Pinger** - Periodic state checks
3. **System Tray** - Start button enable/disable
4. **Invite Code Save** - Triggers state check for server-created configs

## Future Enhancements

The `updateNebulaConfigState()` function is designed to be extensible. You can add additional functionality such as:

- Certificate validation
- Configuration file parsing and validation
- Network interface checks
- Service status monitoring
