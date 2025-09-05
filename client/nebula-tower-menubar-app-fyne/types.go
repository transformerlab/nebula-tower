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

// App represents the main application
type App struct {
	config               *Config
	configPath           string
	fyneApp              fyne.App
	settingsOpen         bool
	inviteCodeField      *widget.Entry
	saveInviteCodeBtn    *widget.Button
	towerConnectionLabel *widget.Label
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
