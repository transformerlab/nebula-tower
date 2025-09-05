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

// startNebulaService simulates starting the Nebula service
func (a *App) startNebulaService() {
	log.Println("Starting Nebula service...")
	// TODO: Implement actual Nebula service start logic
	// This could include:
	// 1. Actual nebula process management
	// 2. Service status checking
	// 3. Network interface management
	// 4. Certificate validation
}

// setupSystemTray creates and configures the system tray
func (a *App) setupSystemTray() {
	if desk, ok := a.fyneApp.(desktop.App); ok {
		// Load icon resource
		iconResource := getIcon()
		
		// Create system tray menu
		menu := fyne.NewMenu("Nebula Tower",
			fyne.NewMenuItem("Start Nebula", func() {
				a.startNebulaService()
			}),
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Settings", func() {
				a.showSettingsWindow()
			}),
			fyne.NewMenuItem("Debug Log", func() {
				a.showDebugLog()
			}),
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem("Quit", func() {
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
		config:       &Config{},
		configPath:   getConfigPath(),
		fyneApp:      fyneApp,
		settingsOpen: false,
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

	// Create the invite code field
	inviteCodeField := widget.NewEntry()
	inviteCodeField.SetPlaceHolder("Enter invite code")
	inviteCodeField.Disable() // Initially disabled until connected to the lighthouse

	// Store the invite code field in the app structure so settings can access it
	nebulaApp.inviteCodeField = inviteCodeField

	// Start the lighthouse pinger
	StartLighthousePinger(nebulaApp)

	log.Println("Starting Nebula Tower menubar application...")

	// Handle system signals gracefully
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	
	go func() {
		<-sigChan
		log.Println("System signal received, quitting...")
		fyneApp.Quit()
	}()

	// Run the app (this blocks until the app is closed)
	fyneApp.Run()
	
	log.Println("Nebula Tower menubar app exiting...")
}