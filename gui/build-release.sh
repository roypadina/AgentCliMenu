#!/bin/sh
# Build the Homebrew-cask release artifact: AgentCliMenu.app with the agent-cli-menu + acm CLI
# bundled inside (Contents/Resources/cli), then zip it. The cask installs the app and
# symlinks the bundled bin shims onto PATH; they run on Node (depends_on node).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "› npm run build"
npm run build >/dev/null

echo "› swift build -c release"
( cd gui/AgentCliMenuBar && swift build -c release >/dev/null )
BIN="gui/AgentCliMenuBar/.build/release/AgentCliMenuBar"

APP="gui/Agent CLI Menu.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/AgentCliMenuBar"
cp gui/AgentCliMenuBar/Info.plist "$APP/Contents/Info.plist"

# ── bundle the CLI (production deps only) inside the app ──
echo "› staging cli/ with production node_modules"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp package.json package-lock.json "$STAGE/"
( cd "$STAGE" && npm ci --omit=dev --silent >/dev/null )

CLI="$APP/Contents/Resources/cli"
mkdir -p "$CLI"
cp -R dist "$CLI/dist"
cp -R bin "$CLI/bin"
cp -R "$STAGE/node_modules" "$CLI/node_modules"
cp package.json "$CLI/package.json"
chmod +x "$CLI/bin/"*

# ad-hoc sign (un-notarized, local use — same as Cloney/LanGuard)
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

# ── zip ──
ZIP="gui/AgentCliMenu.zip"
rm -f "$ZIP"
( cd gui && ditto -c -k --sequesterRsrc --keepParent "Agent CLI Menu.app" "AgentCliMenu.zip" )

SHA=$(shasum -a 256 "$ZIP" | cut -d' ' -f1)
SIZE=$(du -h "$ZIP" | cut -f1)
echo "✓ built $ROOT/$ZIP  ($SIZE)"
echo "  sha256: $SHA"
