#!/bin/sh
# Build ClaudeMenuBar.app (menu-bar agent) — release binary + .app bundle + ad-hoc sign.
set -eu
cd "$(dirname "$0")/ClaudeMenuBar"

echo "› swift build -c release"
swift build -c release >/dev/null
BIN=".build/release/ClaudeMenuBar"

APP="../ClaudeMenu.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/ClaudeMenuBar"
cp Info.plist "$APP/Contents/Info.plist"

# ad-hoc sign (same approach as Cloney; un-notarized, local use)
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "✓ built $(cd .. && pwd)/ClaudeMenu.app"
echo "  run:  open '$(cd .. && pwd)/ClaudeMenu.app'   (look for ✦ in the menu bar)"
echo "  needs 'cm' on PATH — install it (brew, or 'npm link' from the repo root) first."
