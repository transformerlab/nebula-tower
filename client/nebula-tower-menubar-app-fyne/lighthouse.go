package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

var connected_to_lighthouse = false

// LighthouseStatus represents the structure of the JSON response from the lighthouse.
type LighthouseStatus struct {
	// Define fields based on the expected JSON structure.
	// Example:
	Status string `json:"status"`
}

// LighthouseData holds the global data from the lighthouse response.
var LighthouseData struct {
	Message             string `json:"message"`
	CompanyName         string `json:"company_name"`
	PublicIP            string `json:"public_ip"`
	NebulaIP            string `json:"nebula_ip"`
	LighthouseIsRunning bool   `json:"lighthouse_is_running"`
}

// StartLighthousePinger starts the process of pinging the lighthouse.
func StartLighthousePinger(app *App) {
	go func() {
		for {
			lighthouseIP := app.GetLighthouseIP()
			if lighthouseIP == "" {
				log.Println("Lighthouse IP not found in settings.")
				connected_to_lighthouse = false
				time.Sleep(5 * time.Second)
				continue
			}

			resp, err := http.Get("http://" + lighthouseIP + "/client/api/info")
			if err != nil {
				log.Printf("Error connecting to lighthouse: %v\n", err)
				connected_to_lighthouse = false
			} else if resp.StatusCode == http.StatusOK {
				// Decode directly into LighthouseData
				if json.NewDecoder(resp.Body).Decode(&LighthouseData) == nil {
					log.Printf("LighthouseData updated: %+v\n", LighthouseData) // Debug log
					if !connected_to_lighthouse {
						log.Println("Successfully connected to lighthouse.")
					}
					connected_to_lighthouse = true
				} else {
					log.Println("Failed to decode lighthouse status response.")
					connected_to_lighthouse = false
				}
				resp.Body.Close()
			} else {
				log.Printf("Unexpected response from lighthouse: %d\n", resp.StatusCode)
				connected_to_lighthouse = false
			}

			// Update the settings UI if it's open
			app.UpdateConnectionStatusUI()

			// Periodically check if nebula config state has changed
			app.updateNebulaConfigState()

			time.Sleep(5 * time.Second)
		}
	}()
}

// UpdateConnectionStatusUI updates the connection status in the settings UI
func (a *App) UpdateConnectionStatusUI() {
	a.updateConnectionStatus()
}