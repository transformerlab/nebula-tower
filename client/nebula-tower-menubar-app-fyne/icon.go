package main

import (
	"fyne.io/fyne/v2"
	"log"
	"os"
)

// getIcon returns the application icon - loads from bundled resource or fallback to dev icon
func getIcon() fyne.Resource {
	// Try multiple possible locations for the icon
	possibleResources := []fyne.Resource{}

	// Check bundled resources
	for _, res := range possibleResources {
		if res != nil {
			log.Printf("Loaded icon from bundled resource: %s", res.Name())
			return res
		}
	}

	// Fallback to development icon
	devIconPath := "./icons/trayIcon.png"
	if fileData, err := os.ReadFile(devIconPath); err == nil {
		log.Printf("Loaded icon from development path: %s", devIconPath)
		return fyne.NewStaticResource("trayIcon.png", fileData)
	}

	log.Printf("Warning: Could not load trayIcon.png from bundled resources or development path, icon may not display")
	return nil
}