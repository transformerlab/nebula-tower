package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)

// checkNebulaBinary checks if nebula binary exists in settings directory
func (a *App) checkNebulaBinary() bool {
	settingsDir := filepath.Dir(a.configPath)
	binDir := filepath.Join(settingsDir, "bin")
	nebulaBinary := filepath.Join(binDir, "nebula")

	if runtime.GOOS == "windows" {
		nebulaBinary += ".exe"
	}

	_, err := os.Stat(nebulaBinary)
	return err == nil
}

// getNebulaDownloadInfo returns the filename and base URL for nebula binaries
func getNebulaDownloadInfo() (string, string, error) {
	baseURL := "https://github.com/NebulaOSS/nebula-nightly/releases/latest/download/"

	switch runtime.GOOS {
	case "darwin":
		return "nebula-darwin.zip", baseURL, nil
	case "linux":
		arch := runtime.GOARCH
		switch arch {
		case "amd64":
			return "nebula-linux-amd64.tar.gz", baseURL, nil
		case "arm64":
			return "nebula-linux-arm64.tar.gz", baseURL, nil
		default:
			return "", "", fmt.Errorf("unsupported Linux architecture: %s", arch)
		}
	case "windows":
		return "nebula-windows-amd64.zip", baseURL, nil
	default:
		return "", "", fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

// downloadFile downloads a file from URL to destination with progress updates
func downloadFile(url, dest string, statusLabel *widget.Label) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download: %s", resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	// Update status during download
	fyne.Do(func() {
		statusLabel.SetText("Downloading nebula binaries...")
	})

	_, err = io.Copy(out, resp.Body)
	return err
}

// extractZip extracts a zip file to destination directory
func extractZip(src, dest string) error {
	reader, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer reader.Close()

	os.MkdirAll(dest, 0755)

	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}

		rc, err := file.Open()
		if err != nil {
			return err
		}

		path := filepath.Join(dest, file.Name)
		os.MkdirAll(filepath.Dir(path), 0755)

		outFile, err := os.Create(path)
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}

		// Make executable
		if strings.Contains(file.Name, "nebula") && !strings.Contains(file.Name, ".") {
			os.Chmod(path, 0755)
		}
	}

	return nil
}

// extractTarGz extracts a tar.gz file to destination directory
func extractTarGz(src, dest string) error {
	file, err := os.Open(src)
	if err != nil {
		return err
	}
	defer file.Close()

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)

	os.MkdirAll(dest, 0755)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		if header.Typeflag != tar.TypeReg {
			continue
		}

		path := filepath.Join(dest, header.Name)
		os.MkdirAll(filepath.Dir(path), 0755)

		outFile, err := os.Create(path)
		if err != nil {
			return err
		}

		_, err = io.Copy(outFile, tarReader)
		outFile.Close()

		if err != nil {
			return err
		}

		// Make executable
		if strings.Contains(header.Name, "nebula") && !strings.Contains(header.Name, ".") {
			os.Chmod(path, 0755)
		}
	}

	return nil
}

// findAndInstallBinaries finds nebula and nebula-cert in extracted files and installs them
func findAndInstallBinaries(extractDir, binDir string) error {
	binaries := []string{"nebula", "nebula-cert"}

	for _, binary := range binaries {
		var found string

		// Walk through extracted directory to find the binary
		err := filepath.Walk(extractDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			fileName := info.Name()
			if runtime.GOOS == "windows" {
				if fileName == binary+".exe" {
					found = path
					return filepath.SkipDir
				}
			} else {
				if fileName == binary {
					found = path
					return filepath.SkipDir
				}
			}
			return nil
		})

		if err != nil {
			return err
		}

		if found == "" {
			return fmt.Errorf("failed to locate %s in archive", binary)
		}

		// Install binary to bin directory
		destPath := filepath.Join(binDir, binary)
		if runtime.GOOS == "windows" {
			destPath += ".exe"
		}

		// Copy file
		srcFile, err := os.Open(found)
		if err != nil {
			return err
		}
		defer srcFile.Close()

		destFile, err := os.Create(destPath)
		if err != nil {
			return err
		}
		defer destFile.Close()

		_, err = io.Copy(destFile, srcFile)
		if err != nil {
			return err
		}

		// Make executable on Unix systems
		if runtime.GOOS != "windows" {
			os.Chmod(destPath, 0755)
		}

		log.Printf("Installed %s to %s", binary, destPath)
	}

	return nil
}

// installNebulaBinaries downloads and installs nebula binaries
func (a *App) installNebulaBinaries(statusLabel *widget.Label) {
	statusLabel.SetText("Preparing to download nebula binaries...")
	statusLabel.Importance = widget.MediumImportance

	go func() {
		// Get download info
		filename, baseURL, err := getNebulaDownloadInfo()
		if err != nil {
			fyne.Do(func() {
				statusLabel.SetText(fmt.Sprintf("❌ %s", err.Error()))
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}

		// Create directories
		settingsDir := filepath.Dir(a.configPath)
		binDir := filepath.Join(settingsDir, "bin")
		if err := os.MkdirAll(binDir, 0755); err != nil {
			fyne.Do(func() {
				statusLabel.SetText("❌ Failed to create bin directory")
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}

		// Create temp directory
		tempDir, err := os.MkdirTemp("", "nebula-install-*")
		if err != nil {
			fyne.Do(func() {
				statusLabel.SetText("❌ Failed to create temp directory")
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}
		defer os.RemoveAll(tempDir)

		// Download file
		downloadPath := filepath.Join(tempDir, filename)
		downloadURL := baseURL + filename

		log.Printf("Downloading %s", downloadURL)
		if err := downloadFile(downloadURL, downloadPath, statusLabel); err != nil {
			fyne.Do(func() {
				statusLabel.SetText(fmt.Sprintf("❌ Failed to download: %v", err))
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}

		// Extract archive
		fyne.Do(func() {
			statusLabel.SetText("Extracting nebula binaries...")
		})

		extractDir := filepath.Join(tempDir, "extracted")
		if strings.HasSuffix(filename, ".zip") {
			err = extractZip(downloadPath, extractDir)
		} else if strings.HasSuffix(filename, ".tar.gz") {
			err = extractTarGz(downloadPath, extractDir)
		} else {
			err = fmt.Errorf("unsupported archive format: %s", filename)
		}

		if err != nil {
			fyne.Do(func() {
				statusLabel.SetText(fmt.Sprintf("❌ Failed to extract: %v", err))
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}

		// Find and install binaries
		fyne.Do(func() {
			statusLabel.SetText("Installing nebula binaries...")
		})

		if err := findAndInstallBinaries(extractDir, binDir); err != nil {
			fyne.Do(func() {
				statusLabel.SetText(fmt.Sprintf("❌ Failed to install: %v", err))
				statusLabel.Importance = widget.DangerImportance
			})
			return
		}

		fyne.Do(func() {
			statusLabel.SetText("✅ Nebula binaries successfully installed")
			statusLabel.Importance = widget.SuccessImportance
		})
	}()
}

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