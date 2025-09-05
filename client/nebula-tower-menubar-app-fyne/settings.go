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
	if a.settingsOpen {
		return // Don't open multiple settings windows
	}

	a.settingsOpen = true
	log.Println("Opening settings window...")

	// Create settings window
	settingsWindow := a.fyneApp.NewWindow("Nebula Tower Settings")
	settingsWindow.Resize(fyne.NewSize(450, 350))
	settingsWindow.SetFixedSize(true)

	// Load current config
	config := a.config

	// Create form fields with better styling
	towerIPEntry := widget.NewEntry()
	towerIPEntry.SetText(config.TowerIP)
	towerIPEntry.SetPlaceHolder("e.g., 127.0.0.1:8080")

	inviteCodeEntry := widget.NewEntry()
	inviteCodeEntry.SetText(config.InviteCode)
	inviteCodeEntry.SetPlaceHolder("Enter your invite code")
	inviteCodeEntry.Password = true // Hide the invite code for security

	// Status label for feedback
	statusLabel := widget.NewLabel("")

	// Create save button that saves all settings at once
	saveBtn := widget.NewButton("Save Settings", func() {
		a.config.TowerIP = towerIPEntry.Text
		a.config.InviteCode = inviteCodeEntry.Text

		if err := a.saveConfig(); err != nil {
			log.Printf("Error saving settings: %v", err)
			statusLabel.SetText("❌ Failed to save settings")
			statusLabel.Importance = widget.DangerImportance
		} else {
			log.Printf("Settings saved - Tower IP: %s", a.config.TowerIP)
			statusLabel.SetText("✅ Settings saved successfully")
			statusLabel.Importance = widget.SuccessImportance
		}
	})

	// Create close button
	closeBtn := widget.NewButton("Close", func() {
		settingsWindow.Close()
	})

	// Create form layout with better organization
	form := container.NewVBox(
		widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Tower IP Address:"),
			towerIPEntry,
		)),
		widget.NewCard("", "", container.NewVBox(
			widget.NewLabel("Invite Code:"),
			inviteCodeEntry,
		)),
		statusLabel,
		container.NewHBox(saveBtn, closeBtn),
	)

	settingsWindow.SetContent(container.NewPadded(form))

	// Handle window close event
	settingsWindow.SetOnClosed(func() {
		a.settingsOpen = false
	})

	settingsWindow.Show()
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