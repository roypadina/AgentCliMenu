# ClaudeMenu — Mac menu-bar GUI

A tiny `LSUIElement` menu-bar agent (✦) that opens your configured terminal running `cm`.
It is a **thin launcher**: it never reads `~/.claude` or parses TOML itself — it asks the
CLI for everything via `cm gui-config`, then opens a terminal.

## Build / run

```sh
./build-app.sh                 # → gui/ClaudeMenu.app (release, ad-hoc signed)
open ./ClaudeMenu.app          # ✦ appears in the menu bar
```

`cm` must be on `PATH`. Until the brew formula ships, expose it from the repo root:

```sh
cd .. && npm run build && npm link      # puts cm/cld/ccsm on PATH (reversible: npm unlink -g claudemenu)
```

Menu items: **New session** (`cm new`), **Resume session…** (`cm resume`),
**Edit config** (`cm config --setup` then opens it), **Quit**.

## GUI ↔ CLI contract

The app runs `cm gui-config --for <root|new|resume>` and parses JSON:

```json
{
  "contractVersion": 1,
  "terminal": "Terminal" | "iTerm" | "custom",
  "cmBin": "/opt/homebrew/bin/cm",
  "cmCommand": "/opt/homebrew/bin/cm new",
  "configPath": "~/.config/claudemenu/config.toml",
  "customTemplate": null,
  "entry": "new",
  "warnings": []
}
```

- `terminal` comes from the `[gui]` table in the config.
- `cmCommand` is the full, path-quoted shell command for the entry. The app passes it to
  `osascript` as an **argv element** (`-- <cmCommand>`), never interpolated into the script
  body, so a command with quotes/`;`/spaces can't break or inject AppleScript.
- All Swift `Codable` fields are optional + there's a `contractVersion`, so the CLI can add
  fields without breaking an older app. Never rename a field.

## cm resolution

The Swift side probes a fixed list (it can't rely on a GUI's minimal `PATH`):
`/opt/homebrew/bin/cm`, `/usr/local/bin/cm`, `~/.local/bin/cm`. `$CM_BIN` overrides for dev
(e.g. `CM_BIN="node /path/to/repo/bin/cm"`). If none resolve, it falls back to `cm` on PATH.

## Notes

- Not notarized — ad-hoc signed for local/team use (same as Cloney). A future brew cask can ship it.
- `terminal = "custom"` uses `launch_command` from `[gui]` with `{{cmd}}` substituted, run via `/bin/sh -c`.
