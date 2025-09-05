package main

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/widget"
)

// Config represents the application configuration
type Config struct {
	TowerIP    string `json:"tower_ip"`
	InviteCode string `json:"invite_code"`
}

// LighthouseDetails represents the lighthouse information
type LighthouseDetails struct {
	Message             string `json:"message"`
	CompanyName         string `json:"company_name"`
	PublicIP            string `json:"public_ip"`
	NebulaIP            string `json:"nebula_ip"`
	LighthouseIsRunning bool   `json:"lighthouse_is_running"`
	Connected           bool   // Internal flag to track connection status
}

// App represents the main application
type App struct {
	fyneApp                        fyne.App
	config                         *Config
	configPath                     string
	settingsWindow                 fyne.Window // Stores the settings window reference
	settingsOpen                   bool
	towerConnectionLabel           *widget.Label
	saveInviteCodeBtn              *widget.Button
	inviteCodeField                *widget.Entry         // Global invite code field (used in main)
	currentSettingsInviteCodeField *widget.Entry         // Current settings window invite code field
	nebulaConfigExists             bool                  // Tracks if nebula config files exist
	startMenuItem                  *fyne.MenuItem        // Reference to start menu item for enabling/disabling
	lighthouseDetails              *LighthouseDetails    // Stores lighthouse information
}

// GetLighthouseIP returns the lighthouse IP from the app's configuration
func (a *App) GetLighthouseIP() string {
	if a.config == nil {
		return ""
	}
	return a.config.TowerIP
}

// GetInviteCode returns the invite code from the app's configuration
func (a *App) GetInviteCode() string {
	if a.config == nil {
		return ""
	}
	return a.config.InviteCode
}

// GetConfig returns a copy of the current configuration
func (a *App) GetConfig() Config {
	if a.config == nil {
		return Config{}
	}
	return *a.config
}

// GetLighthouseDetails returns the current lighthouse details
func (a *App) GetLighthouseDetails() *LighthouseDetails {
	return a.lighthouseDetails
}

// SetLighthouseDetails updates the lighthouse details in the app
func (a *App) SetLighthouseDetails(details *LighthouseDetails) {
	a.lighthouseDetails = details
}

// IsConnectedToLighthouse returns whether the app is connected to the lighthouse
func (a *App) IsConnectedToLighthouse() bool {
	return a.lighthouseDetails != nil && a.lighthouseDetails.Connected
}
