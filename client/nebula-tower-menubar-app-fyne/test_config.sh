#!/bin/bash

# Script to test nebula config state management
# This creates or removes test config files to verify the start button state management

CONFIG_DIR="$HOME/Library/Application Support/Nebula Tower"

case "$1" in
    create)
        echo "Creating test nebula config files in: $CONFIG_DIR"
        mkdir -p "$CONFIG_DIR"
        
        # Create test config files
        echo "# Test nebula config" > "$CONFIG_DIR/config.yaml"
        echo "-----BEGIN CERTIFICATE-----" > "$CONFIG_DIR/ca.crt"
        echo "test-ca-certificate-content" >> "$CONFIG_DIR/ca.crt"
        echo "-----END CERTIFICATE-----" >> "$CONFIG_DIR/ca.crt"
        
        echo "-----BEGIN CERTIFICATE-----" > "$CONFIG_DIR/host.crt"
        echo "test-host-certificate-content" >> "$CONFIG_DIR/host.crt"
        echo "-----END CERTIFICATE-----" >> "$CONFIG_DIR/host.crt"
        
        echo "-----BEGIN PRIVATE KEY-----" > "$CONFIG_DIR/host.key"
        echo "test-host-private-key-content" >> "$CONFIG_DIR/host.key"
        echo "-----END PRIVATE KEY-----" >> "$CONFIG_DIR/host.key"
        
        echo "Test config files created successfully!"
        echo "The start button should now be enabled in the app."
        ;;
        
    remove)
        echo "Removing test nebula config files from: $CONFIG_DIR"
        rm -f "$CONFIG_DIR/config.yaml"
        rm -f "$CONFIG_DIR/ca.crt" 
        rm -f "$CONFIG_DIR/host.crt"
        rm -f "$CONFIG_DIR/host.key"
        
        echo "Test config files removed successfully!"
        echo "The start button should now be disabled in the app."
        ;;
        
    check)
        echo "Checking for nebula config files in: $CONFIG_DIR"
        echo
        
        for file in config.yaml ca.crt host.crt host.key; do
            if [[ -f "$CONFIG_DIR/$file" ]]; then
                echo "✅ $file exists"
            else
                echo "❌ $file missing"
            fi
        done
        ;;
        
    *)
        echo "Usage: $0 {create|remove|check}"
        echo
        echo "  create - Create test nebula config files"
        echo "  remove - Remove test nebula config files" 
        echo "  check  - Check if nebula config files exist"
        exit 1
        ;;
esac
