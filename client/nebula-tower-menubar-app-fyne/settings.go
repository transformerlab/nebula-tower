package main

import (
	"fmt"
	"log"
	"os"
	"runtime"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)


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

	// Use the global invite code field instead of creating a new one
	inviteCodeEntry := a.inviteCodeField
	if inviteCodeEntry == nil {
		// Fallback if inviteCodeField is not initialized
		inviteCodeEntry = widget.NewEntry()
		inviteCodeEntry.Disable()
	}
	inviteCodeEntry.SetText(config.InviteCode)
	inviteCodeEntry.SetPlaceHolder("Enter your invite code")
	inviteCodeEntry.Password = true // Hide the invite code for security

	// Connection status labels
	towerConnectionLabel := widget.NewLabel("")
	a.towerConnectionLabel = towerConnectionLabel // Store reference
	a.updateConnectionStatus()                    // Initial update

	// Update invite code field state based on lighthouse connection
	if !connected_to_lighthouse {
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
		}
	})

	a.saveInviteCodeBtn = saveInviteCodeBtn // Store reference
	a.updateConnectionStatus()               // Update button state

	// Create close button
	closeBtn := widget.NewButton("Close", func() {
		settingsWindow.Close()
	})

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
		widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Invite Code:"),
			inviteCodeEntry,
			saveInviteCodeBtn,
		)),
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
	})

	// Prevent window close from quitting the app
	settingsWindow.SetCloseIntercept(func() {
		a.settingsOpen = false
		a.towerConnectionLabel = nil
		a.saveInviteCodeBtn = nil
		settingsWindow.Hide()
	})

	settingsWindow.Show()
}

// updateConnectionStatus updates the connection status UI elements
func (a *App) updateConnectionStatus() {
	// Ensure UI updates happen on the main thread
	fyne.Do(func() {
		if a.towerConnectionLabel != nil {
			if connected_to_lighthouse {
				a.towerConnectionLabel.SetText("✅ Connected to tower")
				a.towerConnectionLabel.Importance = widget.SuccessImportance
			} else {
				a.towerConnectionLabel.SetText("❌ Not connected to tower")
				a.towerConnectionLabel.Importance = widget.DangerImportance
			}
		}

		if a.saveInviteCodeBtn != nil {
			if connected_to_lighthouse {
				a.saveInviteCodeBtn.Enable()
			} else {
				a.saveInviteCodeBtn.Disable()
			}
		}

		if a.inviteCodeField != nil {
			if connected_to_lighthouse {
				a.inviteCodeField.Enable()
			} else {
				a.inviteCodeField.Disable()
			}
		}
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