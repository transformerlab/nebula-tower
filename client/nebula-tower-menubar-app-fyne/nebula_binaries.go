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
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"fyne.io/fyne/v2"
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

// getNebulaVersion runs nebula -version and returns the output
func (a *App) getNebulaVersion() (string, error) {
	settingsDir := filepath.Dir(a.configPath)
	binDir := filepath.Join(settingsDir, "bin")
	nebulaBinary := filepath.Join(binDir, "nebula")

	if runtime.GOOS == "windows" {
		nebulaBinary += ".exe"
	}

	// Check if binary exists
	if _, err := os.Stat(nebulaBinary); os.IsNotExist(err) {
		return "", fmt.Errorf("nebula binary not found at %s", nebulaBinary)
	}

	// Execute nebula -version
	cmd := exec.Command(nebulaBinary, "-version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to execute nebula -version: %v", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// getHostCertDetails runs nebula-cert print -path host.crt -json and returns the output
func (a *App) getHostCertDetails(hostCertPath string) (string, error) {
	settingsDir := filepath.Dir(a.configPath)
	binDir := filepath.Join(settingsDir, "bin")
	nebulaCertBinary := filepath.Join(binDir, "nebula-cert")

	if runtime.GOOS == "windows" {
		nebulaCertBinary += ".exe"
	}

	// Check if binary exists
	if _, err := os.Stat(nebulaCertBinary); os.IsNotExist(err) {
		return "", fmt.Errorf("nebula-cert binary not found at %s", nebulaCertBinary)
	}

	// Execute nebula-cert print -path host.crt -json
	cmd := exec.Command(nebulaCertBinary, "print", "-path", hostCertPath, "-json")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to execute nebula-cert print: %v", err)
	}

	return strings.TrimSpace(string(output)), nil
}
