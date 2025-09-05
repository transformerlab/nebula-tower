package main

import (
	"fyne.io/fyne/v2"
	"log"
)

// getIcon returns the application icon - loads from bundled resource
func getIcon() fyne.Resource {
	// Try multiple possible locations for the icon
	possibleResources := []fyne.Resource{
		resourceTrayIconPng, // Bundled resource
	}

	for _, res := range possibleResources {
		if res != nil {
			log.Printf("Loaded icon from bundled resource: %s", res.Name())
			return res
		}
	}

	log.Printf("Warning: Could not load trayIcon.png from bundled resources, icon may not display")
	return nil
}
