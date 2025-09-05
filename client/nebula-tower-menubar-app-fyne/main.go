package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/widget"
)

// loadConfig loads configuration from file
func (a *App) loadConfig() error {
	if _, err := os.Stat(a.configPath); os.IsNotExist(err) {
		// Create default config
		a.config = &Config{
			TowerIP:    "127.0.0.1:8080",
			InviteCode: "",
		}
		return a.saveConfig()
	}

	data, err := ioutil.ReadFile(a.configPath)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, a.config)
}

// saveConfig saves configuration to file
func (a *App) saveConfig() error {
	data, err := json.MarshalIndent(a.config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure config directory exists
	if err := os.MkdirAll(filepath.Dir(a.configPath), 0755); err != nil {
		return err
	}

	return ioutil.WriteFile(a.configPath, data, 0644)
}

// startNebulaService starts the Nebula daemon and tracks its PID
func (a *App) startNebulaService() {
	if !a.nebulaConfigExists {
		log.Println("Cannot start Nebula: configuration files not found")
		return
	}
	
	if a.isNebulaRunning {
		log.Println("Nebula daemon is already running")
		return
	}
	
	log.Println("Starting Nebula service...")
	pid, err := a.runNebulaDaemon()
	if err != nil {
		log.Printf("Failed to start Nebula daemon: %v", err)
		return
	}
	
	a.nebulaDaemonPID = pid
	a.isNebulaRunning = true
	log.Printf("Nebula daemon started with PID: %d", pid)
	
	// Refresh the system tray menu to show stop button
	a.refreshSystemTrayMenu()
}

// stopNebulaService stops the Nebula daemon
func (a *App) stopNebulaService() {
	if !a.isNebulaRunning || a.nebulaDaemonPID <= 0 {
		log.Println("Nebula daemon is not running")
		return
	}
	
	log.Printf("Stopping Nebula service with PID: %d", a.nebulaDaemonPID)
	err := a.stopNebulaDaemon(a.nebulaDaemonPID)
	if err != nil {
		log.Printf("Failed to stop Nebula daemon: %v", err)
		// Still mark as not running and reset PID since the process might be gone
	}
	
	a.nebulaDaemonPID = 0
	a.isNebulaRunning = false
	log.Println("Nebula daemon stopped")
	
	// Refresh the system tray menu to show start button
	a.refreshSystemTrayMenu()
}

// checkNebulaProcessStatus periodically checks if the nebula daemon is still running
func (a *App) checkNebulaProcessStatus() {
	if a.nebulaDaemonPID > 0 {
		isRunning := a.isProcessRunning(a.nebulaDaemonPID)
		if !isRunning && a.isNebulaRunning {
			// Process died unexpectedly
			log.Printf("Nebula daemon (PID: %d) has stopped unexpectedly", a.nebulaDaemonPID)
			a.nebulaDaemonPID = 0
			a.isNebulaRunning = false
			a.refreshSystemTrayMenu()
		} else if isRunning && !a.isNebulaRunning {
			// Process is running but we thought it was stopped
			a.isNebulaRunning = true
			a.refreshSystemTrayMenu()
		}
	}
}

// getConnectionStatus returns the connection status text for the system tray
func (a *App) getConnectionStatus() string {
	details := a.GetLighthouseDetails()
	if details != nil && details.Connected {
		if details.CompanyName != "" {
			return "Connected to " + details.CompanyName
		}
		return "Connected to Lighthouse"
	}
	return "Not Connected"
}

// getIPStatus returns the IP address status text for the system tray
func (a *App) getIPStatus() string {
	myIP := a.GetMyIP()
	if myIP != "" {
		return "My IP: " + myIP
	}
	return "My IP: Not Available"
}

// setupSystemTray creates and configures the system tray
func (a *App) setupSystemTray() {
	if desk, ok := a.fyneApp.(desktop.App); ok {
		// Load icon resource
		iconResource := getIcon()
		
		// Create start/stop menu item based on current state
		var startStopMenuItem *fyne.MenuItem
		if a.isNebulaRunning {
			startStopMenuItem = fyne.NewMenuItem("Stop Nebula", func() {
				a.stopNebulaService()
			})
		} else {
			startStopMenuItem = fyne.NewMenuItem("Start Nebula", func() {
				a.startNebulaService()
			})
		}
		startStopMenuItem.Disabled = !a.nebulaConfigExists // Disabled if no config exists
		a.startMenuItem = startStopMenuItem // Store reference for later updates
		
		// Create connection status menu item
		statusText := a.getConnectionStatus()
		statusMenuItem := fyne.NewMenuItem(statusText, nil)
		statusMenuItem.Disabled = true // Make it non-clickable
		
		// Create IP address menu item
		ipText := a.getIPStatus()
		ipMenuItem := fyne.NewMenuItem(ipText, nil)
		ipMenuItem.Disabled = true // Make it non-clickable
		
		// Create system tray menu
		menu := fyne.NewMenu("Nebula Tower",
			statusMenuItem,
			ipMenuItem,
			fyne.NewMenuItemSeparator(),
			startStopMenuItem,
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Settings", func() {
				a.showSettingsWindow()
			}),
			fyne.NewMenuItem("Debug Log", func() {
				a.showDebugLog()
			}),
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Quit", func() {
				// Stop nebula daemon if it's running
				if a.isNebulaRunning && a.nebulaDaemonPID > 0 {
					log.Printf("Stopping nebula daemon (PID: %d) before exit", a.nebulaDaemonPID)
					a.stopNebulaDaemon(a.nebulaDaemonPID)
				}
				a.fyneApp.Quit()
			}),
		)
		
		desk.SetSystemTrayMenu(menu)
		desk.SetSystemTrayIcon(iconResource)
		
		log.Println("System tray initialized successfully")
	} else {
		log.Println("Warning: Desktop features not available, system tray not initialized")
	}
}

// refreshSystemTrayMenu refreshes the system tray menu to update menu item states
func (a *App) refreshSystemTrayMenu() {
	if desk, ok := a.fyneApp.(desktop.App); ok {
		// Create start/stop menu item based on current state
		var startStopMenuItem *fyne.MenuItem
		if a.isNebulaRunning {
			startStopMenuItem = fyne.NewMenuItem("Stop Nebula", func() {
				a.stopNebulaService()
			})
		} else {
			startStopMenuItem = fyne.NewMenuItem("Start Nebula", func() {
				a.startNebulaService()
			})
		}
		startStopMenuItem.Disabled = !a.nebulaConfigExists // Disabled if no config exists
		a.startMenuItem = startStopMenuItem // Update reference
		
		// Create connection status menu item
		statusText := a.getConnectionStatus()
		statusMenuItem := fyne.NewMenuItem(statusText, nil)
		statusMenuItem.Disabled = true // Make it non-clickable
		
		// Create IP address menu item
		ipText := a.getIPStatus()
		ipMenuItem := fyne.NewMenuItem(ipText, nil)
		ipMenuItem.Disabled = true // Make it non-clickable
		
		// Recreate system tray menu
		menu := fyne.NewMenu("Nebula Tower",
			statusMenuItem,
			ipMenuItem,
			fyne.NewMenuItemSeparator(),
			startStopMenuItem,
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Settings", func() {
				a.showSettingsWindow()
			}),
			fyne.NewMenuItem("Debug Log", func() {
				a.showDebugLog()
			}),
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Quit", func() {
				// Stop nebula daemon if it's running
				if a.isNebulaRunning && a.nebulaDaemonPID > 0 {
					log.Printf("Stopping nebula daemon (PID: %d) before exit", a.nebulaDaemonPID)
					a.stopNebulaDaemon(a.nebulaDaemonPID)
				}
				a.fyneApp.Quit()
			}),
		)
		
		desk.SetSystemTrayMenu(menu)
		log.Println("System tray menu refreshed")
	}
}

// Note: getIcon is defined in icon.go

// getConfigPath returns the platform-specific config file path
func getConfigPath() string {
	var configDir string
	
	switch runtime.GOOS {
	case "windows":
		// Windows: %APPDATA%\Nebula Tower\
		appData, err := os.UserConfigDir()
		if err != nil {
			// Fallback to APPDATA environment variable
			if appData = os.Getenv("APPDATA"); appData == "" {
				log.Fatal("Failed to get Windows config directory:", err)
			}
		}
		configDir = filepath.Join(appData, "Nebula Tower")
		
	case "darwin":
		// macOS: ~/Library/Application Support/Nebula Tower/
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get user home directory:", err)
		}
		configDir = filepath.Join(homeDir, "Library", "Application Support", "Nebula Tower")
		
	case "linux":
		// Linux: ~/.config/nebula-tower/
		configDir, err := os.UserConfigDir()
		if err != nil {
			// Fallback to XDG_CONFIG_HOME or ~/.config
			if configDir = os.Getenv("XDG_CONFIG_HOME"); configDir == "" {
				homeDir, homeErr := os.UserHomeDir()
				if homeErr != nil {
					log.Fatal("Failed to get user home directory:", homeErr)
				}
				configDir = filepath.Join(homeDir, ".config")
			}
		}
		configDir = filepath.Join(configDir, "nebula-tower")
		
	default:
		// Fallback for other operating systems
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get user home directory:", err)
		}
		configDir = filepath.Join(homeDir, ".nebula-tower")
	}
	
	return filepath.Join(configDir, "config.json")
}

func main() {
	// Create Fyne app
	fyneApp := app.NewWithID("io.nebula-tower.menubar")

	// Set app icon
	iconResource := getIcon()
	fyneApp.SetIcon(iconResource)

	// Initialize app structure
	nebulaApp := &App{
		config:            &Config{},
		configPath:        getConfigPath(),
		fyneApp:           fyneApp,
		settingsOpen:      false,
		lighthouseDetails: &LighthouseDetails{Connected: false}, // Initialize lighthouse details
		nebulaDaemonPID:   0,    // Initialize PID as 0 (not running)
		isNebulaRunning:   false, // Initialize as not running
	}

	// Load configuration
	if err := nebulaApp.loadConfig(); err != nil {
		log.Printf("Warning: Failed to load config from %s: %v", nebulaApp.configPath, err)
		// Continue with default config
		nebulaApp.config = &Config{
			TowerIP:    "127.0.0.1:8080",
			InviteCode: "",
		}
	} else {
		log.Printf("Configuration loaded from: %s", nebulaApp.configPath)
	}

	// Set up system tray
	nebulaApp.setupSystemTray()

	// Check initial nebula config state and update UI accordingly
	nebulaApp.updateNebulaConfigState()

	// Create the invite code field
	inviteCodeField := widget.NewEntry()
	inviteCodeField.SetPlaceHolder("Enter invite code")
	inviteCodeField.Disable() // Initially disabled until connected to the lighthouse

	// Store the invite code field in the app structure so settings can access it
	nebulaApp.inviteCodeField = inviteCodeField

	// Start the lighthouse pinger
	StartLighthousePinger(nebulaApp)

	// Start periodic nebula process status checking
	go func() {
		for {
			time.Sleep(5 * time.Second) // Check every 5 seconds
			nebulaApp.checkNebulaProcessStatus()
		}
	}()

	log.Println("Starting Nebula Tower menubar application...")

	// Handle system signals gracefully
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	
	go func() {
		<-sigChan
		log.Println("System signal received, shutting down...")
		// Stop nebula daemon if it's running
		if nebulaApp.isNebulaRunning && nebulaApp.nebulaDaemonPID > 0 {
			log.Printf("Stopping nebula daemon (PID: %d) before exit", nebulaApp.nebulaDaemonPID)
			nebulaApp.stopNebulaDaemon(nebulaApp.nebulaDaemonPID)
		}
		fyneApp.Quit()
	}()

	// Run the app (this blocks until the app is closed)
	fyneApp.Run()
	
	log.Println("Nebula Tower menubar app exiting...")
}