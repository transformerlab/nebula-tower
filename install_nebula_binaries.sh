#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="$(pwd)/bin"
mkdir -p "$BIN_DIR"

NEBULA_VERSION="latest"
BASE_URL="https://github.com/NebulaOSS/nebula-nightly/releases/${NEBULA_VERSION}/download/"

case "$(uname -s)" in
  Darwin)
    FILE="nebula-darwin.zip"
    ;;
  Linux)
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64) FILE="nebula-linux-amd64.tar.gz" ;;
      aarch64) FILE="nebula-linux-arm64.tar.gz" ;;
      *) echo "Unsupported Linux architecture: $ARCH" >&2; exit 1 ;;
    esac
    ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

echo "Downloading $BASE_URL/$FILE"
cd "$(mktemp -d)"
curl -fsSL -O "$BASE_URL/$FILE"

echo "Extracting $FILE..."
if [[ "$FILE" == *.zip ]]; then
  unzip -o "$FILE"
else
  tar -xzf "$FILE"
fi

# Copy nebula and nebula-cert into BIN_DIR
for BIN in nebula nebula-cert; do
  FOUND=$(find . -type f -name "$BIN" -print -quit 2>/dev/null || true)
  if [[ -z "$FOUND" && -f "$BIN" ]]; then FOUND="$BIN"; fi
  if [[ -z "$FOUND" && -f "./$BIN" ]]; then FOUND="./$BIN"; fi
  if [[ -z "$FOUND" ]]; then
    echo "Failed to locate $BIN in archive" >&2
    exit 1
  fi
  install -m 0755 "$FOUND" "$BIN_DIR/$BIN"
  echo "Installed $BIN to $BIN_DIR/$BIN"
done