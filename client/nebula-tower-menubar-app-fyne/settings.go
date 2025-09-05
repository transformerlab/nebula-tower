package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)

// checkNebulaConfig checks if all required Nebula config files exist
func (a *App) checkNebulaConfig() bool {
	configDir := filepath.Dir(a.configPath)
	requiredFiles := []string{"config.yaml", "ca.crt", "host.crt", "host.key"}

	for _, file := range requiredFiles {
		filePath := filepath.Join(configDir, file)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return false
		}
	}
	return true
}

// updateNebulaConfigState checks nebula config and updates the app state and UI
func (a *App) updateNebulaConfigState() {
	oldState := a.nebulaConfigExists
	a.nebulaConfigExists = a.checkNebulaConfig()
	
	// Log the config directory for debugging
	configDir := filepath.Dir(a.configPath)
	log.Printf("Checking nebula config in directory: %s", configDir)
	
	// If config exists, try to get the host certificate details to extract IP
	if a.nebulaConfigExists {
		a.updateMyIPFromCert()
	} else {
		// Clear IP if no config exists
		a.SetMyIP("")
	}
	
	// If state changed, log the change
	if oldState != a.nebulaConfigExists {
		if a.nebulaConfigExists {
			log.Println("Nebula configuration detected - enabling start button")
		} else {
			log.Println("Nebula configuration not found - disabling start button")
		}
	}
	
	// Update start button state
	a.updateStartButtonState()
}

// updateMyIPFromCert extracts the IP address from the host certificate
func (a *App) updateMyIPFromCert() {
	configDir := filepath.Dir(a.configPath)
	hostCertPath := filepath.Join(configDir, "host.crt")
	
	// Check if host.crt exists
	if _, err := os.Stat(hostCertPath); os.IsNotExist(err) {
		log.Println("host.crt not found, cannot extract IP")
		a.SetMyIP("")
		return
	}
	
	// Get host certificate details
	certOutput, err := a.getHostCertDetails(hostCertPath)
	if err != nil {
		log.Printf("Failed to get host certificate details: %v", err)
		a.SetMyIP("")
		return
	}
	
	// Parse the JSON output
	var certDetails []HostCertDetails
	if err := json.Unmarshal([]byte(certOutput), &certDetails); err != nil {
		log.Printf("Failed to parse host certificate JSON: %v", err)
		a.SetMyIP("")
		return
	}
	
	// Extract the IP address from the first certificate's networks field
	if len(certDetails) > 0 && len(certDetails[0].Details.Networks) > 0 {
		// Get the first network address and extract just the IP part (before the /)
		network := certDetails[0].Details.Networks[0]
		ip := strings.Split(network, "/")[0]
		a.SetMyIP(ip)
		log.Printf("Extracted IP from certificate: %s", ip)
	} else {
		log.Println("No networks found in host certificate")
		a.SetMyIP("")
	}
}

// updateStartButtonState enables or disables the start button based on config state
func (a *App) updateStartButtonState() {
	if a.startMenuItem != nil {
		previousState := a.startMenuItem.Disabled
		if a.nebulaConfigExists {
			a.startMenuItem.Disabled = false
		} else {
			a.startMenuItem.Disabled = true
		}
		// Refresh the system tray menu only if the state has changed
		if previousState != a.startMenuItem.Disabled {
			log.Println("Start button state changed - refreshing system tray menu")
			a.refreshSystemTrayMenu()
		}
	}
}

// deleteNebulaConfig removes all Nebula configuration files
func (a *App) deleteNebulaConfig() error {
	configDir := filepath.Dir(a.configPath)
	filesToDelete := []string{"config.yaml", "ca.crt", "host.crt", "host.key"}

	for _, file := range filesToDelete {
		filePath := filepath.Join(configDir, file)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to delete %s: %v", file, err)
		}
	}
	return nil
}

// showSettingsWindow displays the settings window
func (a *App) showSettingsWindow() {
	if a.settingsWindow != nil {
		// If the settings window is already open, bring it to the foreground
		a.settingsWindow.RequestFocus()
		return
	}

	if a.settingsOpen {
		return // Don't open multiple settings windows
	}

	a.settingsOpen = true
	log.Println("Opening settings window...")

	// Create settings window
	settingsWindow := a.fyneApp.NewWindow("Nebula Tower Settings")
	a.settingsWindow = settingsWindow // Store reference to the settings window
	settingsWindow.Resize(fyne.NewSize(450, 350))
	settingsWindow.SetFixedSize(true)

	// Position window at center of screen
	settingsWindow.SetMaster()
	settingsWindow.CenterOnScreen()

	// Load current config
	config := a.config

	// Create form fields with better styling
	towerIPEntry := widget.NewEntry()
	towerIPEntry.SetText(config.TowerIP)
	towerIPEntry.SetPlaceHolder("e.g., 127.0.0.1:8080")

	// Check nebula binary status
	nebulaBinaryStatus := widget.NewLabel("")
	if a.checkNebulaBinary() {
		nebulaBinaryStatus.SetText("✅ Nebula binary successfully installed")
		nebulaBinaryStatus.Importance = widget.SuccessImportance
	} else {
		nebulaBinaryStatus.SetText("❌ Nebula binary not found")
		nebulaBinaryStatus.Importance = widget.DangerImportance
	}

	// Install nebula binaries button
	installNebulaBinariesBtn := widget.NewButton("Install Nebula Binaries", func() {
		a.installNebulaBinaries(nebulaBinaryStatus)
	})

	// Only show install button if binary is not found
	if a.checkNebulaBinary() {
		installNebulaBinariesBtn.Hide()
	}

	// Check if Nebula config exists
	nebulaConfigExists := a.checkNebulaConfig()

	// Create a new invite code entry field for this settings window
	// Don't reuse the global one to avoid state conflicts
	inviteCodeEntry := widget.NewEntry()
	inviteCodeEntry.SetText(config.InviteCode)
	inviteCodeEntry.SetPlaceHolder("Enter your invite code")
	// inviteCodeEntry.Password = true // Hide the invite code for security

	// Connection status labels
	towerConnectionLabel := widget.NewLabel("")
	a.towerConnectionLabel = towerConnectionLabel // Store reference
	a.updateConnectionStatus()                    // Initial update

	// Update invite code field state based on lighthouse connection
	if connected_to_lighthouse {
		inviteCodeEntry.Enable()
	} else {
		inviteCodeEntry.Disable()
	}

	// Status label for feedback
	statusLabel := widget.NewLabel("")

	// Create save button for Tower IP
	saveTowerIPBtn := widget.NewButton("Save", func() {
		a.config.TowerIP = towerIPEntry.Text

		if err := a.saveConfig(); err != nil {
			log.Printf("Error saving Tower IP: %v", err)
			statusLabel.SetText("❌ Failed to save Tower IP")
			statusLabel.Importance = widget.DangerImportance
		} else {
			log.Printf("Tower IP saved: %s", a.config.TowerIP)
			statusLabel.SetText("✅ Tower IP saved successfully")
			statusLabel.Importance = widget.SuccessImportance
		}
	})

	// Create save button for Invite Code
	saveInviteCodeBtn := widget.NewButton("Save", func() {
		// Only allow saving if connected to lighthouse
		if !connected_to_lighthouse {
			statusLabel.SetText("❌ Must be connected to lighthouse to save invite code")
			statusLabel.Importance = widget.DangerImportance
			return
		}

		a.config.InviteCode = inviteCodeEntry.Text

		if err := a.saveConfig(); err != nil {
			log.Printf("Error saving Invite Code: %v", err)
			statusLabel.SetText("❌ Failed to save Invite Code")
			statusLabel.Importance = widget.DangerImportance
		} else {
			log.Printf("Invite Code saved")
			statusLabel.SetText("✅ Invite Code saved successfully")
			statusLabel.Importance = widget.SuccessImportance
			// Check if nebula config state changed after saving invite code
			// (in case the server creates config files based on the invite code)
			go func() {
				// Wait a moment for potential server processing
				time.Sleep(2 * time.Second)
				a.updateNebulaConfigState()
			}()
		}
	})

	a.saveInviteCodeBtn = saveInviteCodeBtn // Store reference
	
	// Store reference to the current invite code field for connection status updates
	a.currentSettingsInviteCodeField = inviteCodeEntry
	
	// Update button and field states based on connection
	a.updateConnectionStatus()

	// Create close button
	closeBtn := widget.NewButton("Close", func() {
		a.settingsOpen = false
		a.settingsWindow = nil
		a.towerConnectionLabel = nil
		a.saveInviteCodeBtn = nil
		a.currentSettingsInviteCodeField = nil // Clear the settings invite code field reference
		settingsWindow.Hide()
	})

	// Create Nebula Config card content
	var nebulaConfigCard fyne.CanvasObject
	if nebulaConfigExists {
		// Show status and delete button
		nebulaConfigStatus := widget.NewLabel("✅ Nebula configuration exists")
		nebulaConfigStatus.Importance = widget.SuccessImportance

		// Declare button variable first so it can be referenced in the callback
		var deleteConfigBtn *widget.Button
		deleteConfigBtn = widget.NewButton("Delete Configuration", func() {
			if err := a.deleteNebulaConfig(); err != nil {
				log.Printf("Error deleting Nebula config: %v", err)
				statusLabel.SetText("❌ Failed to delete Nebula configuration")
				statusLabel.Importance = widget.DangerImportance
			} else {
				log.Println("Nebula configuration deleted")
				statusLabel.SetText("✅ Nebula configuration deleted - please close and reopen settings to see invite code field")
				statusLabel.Importance = widget.SuccessImportance
				// Update nebula config state after deletion
				a.updateNebulaConfigState()
				
				// Disable the delete button since config no longer exists
				deleteConfigBtn.Disable()
			}
		})

		nebulaConfigCard = widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Nebula Configuration:"),
			nebulaConfigStatus,
			deleteConfigBtn,
		))
	} else {
		// Show invite code field
		nebulaConfigCard = widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Invite Code:"),
			inviteCodeEntry,
			saveInviteCodeBtn,
		))
	}

	// Create form layout with better organization
	form := container.NewVBox(
		widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Tower IP Address:"),
			towerIPEntry,
			saveTowerIPBtn,
			towerConnectionLabel,
		)),
		widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Install Nebula Binaries:"),
			nebulaBinaryStatus,
			installNebulaBinariesBtn,
		)),
		nebulaConfigCard,
		statusLabel,
		closeBtn,
	)

	settingsWindow.SetContent(container.NewPadded(form))

	// Handle window close event
	settingsWindow.SetOnClosed(func() {
		a.settingsOpen = false
		a.settingsWindow = nil // Clear the reference when the window is closed
		a.towerConnectionLabel = nil
		a.saveInviteCodeBtn = nil
		a.currentSettingsInviteCodeField = nil // Clear the settings invite code field reference
	})

	// Prevent window close from quitting the app
	settingsWindow.SetCloseIntercept(func() {
		a.settingsOpen = false
		a.towerConnectionLabel = nil
		a.saveInviteCodeBtn = nil
		a.currentSettingsInviteCodeField = nil // Clear the settings invite code field reference
		settingsWindow.Hide()
	})

	settingsWindow.Show()
}

// updateConnectionStatus updates the connection status UI elements
func (a *App) updateConnectionStatus() {
	// Ensure UI updates happen on the main thread
	fyne.Do(func() {
		isConnected := a.IsConnectedToLighthouse()
		details := a.GetLighthouseDetails()
		
		if a.towerConnectionLabel != nil {
			if isConnected && details != nil {
				connectionText := "✅ Connected to tower"
				if details.CompanyName != "" {
					connectionText = "✅ Connected to " + details.CompanyName
				}
				a.towerConnectionLabel.SetText(connectionText)
				a.towerConnectionLabel.Importance = widget.SuccessImportance
			} else {
				a.towerConnectionLabel.SetText("❌ Not connected to tower")
				a.towerConnectionLabel.Importance = widget.DangerImportance
			}
		}

		if a.saveInviteCodeBtn != nil {
			if isConnected {
				a.saveInviteCodeBtn.Enable()
			} else {
				a.saveInviteCodeBtn.Disable()
			}
		}

		// Update the global invite code field (used in main)
		if a.inviteCodeField != nil {
			if isConnected {
				a.inviteCodeField.Enable()
			} else {
				a.inviteCodeField.Disable()
			}
		}

		// Update the current settings window invite code field
		if a.currentSettingsInviteCodeField != nil {
			if isConnected {
				a.currentSettingsInviteCodeField.Enable()
			} else {
				a.currentSettingsInviteCodeField.Disable()
			}
		}

		// Refresh the system tray menu to update the connection status
		a.refreshSystemTrayMenu()
	})
}

// showDebugLog displays the debug log information in a window
func (a *App) showDebugLog() {
	log.Println("Opening debug log...")

	debugWindow := a.fyneApp.NewWindow("Debug Information")
	debugWindow.Resize(fyne.NewSize(500, 400))

	debugInfo := widget.NewRichTextFromMarkdown(`## Debug Information

**Config file location:** ` + a.configPath + `
**Tower IP:** ` + a.config.TowerIP + `
**Invite Code:** [REDACTED]
**Process ID:** ` + fmt.Sprintf("%d", os.Getpid()) + `
**OS:** ` + runtime.GOOS + `
**Architecture:** ` + runtime.GOARCH + `

---
*This information can help with troubleshooting configuration issues.*`)

	debugInfo.Wrapping = fyne.TextWrapWord

	closeBtn := widget.NewButton("Close", func() {
		debugWindow.Close()
	})

	content := container.NewVBox(
		container.NewScroll(debugInfo),
		closeBtn,
	)

	debugWindow.SetContent(container.NewPadded(content))
	debugWindow.Show()
}