package main

import "fyne.io/fyne/v2"

// Config represents the application configuration
type Config struct {
	TowerIP    string `json:"tower_ip"`
	InviteCode string `json:"invite_code"`
}

// App represents the main application
type App struct {
	config       *Config
	configPath   string
	fyneApp      fyne.App
	settingsOpen bool
}
