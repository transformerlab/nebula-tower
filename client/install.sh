#!/usr/bin/env bash

set -e

if command -v nebula &> /dev/null; then
  echo "nebula is already installed."
  NEBULA_VERSION_INSTALLED="$(nebula -version 2>&1 || true)"
  echo "Installed version: $NEBULA_VERSION_INSTALLED"
  exit 0
fi

NEBULA_VERSION="latest"
BASE_URL="https://github.com/slackhq/nebula/releases/${NEBULA_VERSION}/download/"

# Map OS/arch to filename and sha256
case "$(uname -s)" in
  Darwin)
    FILE="nebula-darwin.zip"
    SHA256="1f589c7e5b096f6c619d3a37b2d13194fcedb0f75482bcc0455f937ca84b0f91"
    ;;
  Linux)
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64)
        FILE="nebula-linux-amd64.tar.gz"
        SHA256="37f5ff70033fbe92964f190bf59c0c4f5f7118c552febfb0528319c0a6856dff"
        ;;
      aarch64)
        FILE="nebula-linux-arm64.tar.gz"
        SHA256="14d884cac8e204024534572324a48963f7c727a9c0a582c732f7696ed73e8837"
        ;;
      *)
        echo "Unsupported Linux architecture: $ARCH"
        exit 1
        ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

echo "Downloading $BASE_URL/$FILE"
curl -LO "$BASE_URL/$FILE"

# @TODO adjust to use specific version if you are confirming checksums
# echo "$SHA256  $FILE" | sha256sum -c -

echo "Extracting $FILE..."
if [[ "$FILE" == *.zip ]]; then
  unzip -o "$FILE"
else
  tar -xzf "$FILE"
fi

echo "Done."
