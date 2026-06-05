# Changelog

All notable changes to Agent CLI Menu are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.2.0] — 2026-06-05

### Changed (breaking)

- **Commands renamed.** The three separate commands `cm` / `cld` / `ccsm` are replaced by a single
  **`agent-cli-menu`** (short alias **`acm`**). It opens **New** by default; **`-r`** / **`--resume`**
  opens **Resume**. Want `cld`/`cdx`-style per-tool shortcuts? Add your own shell aliases. After
  `brew upgrade --cask agentclimenu`, the old `cm`/`cld`/`ccsm` symlinks are removed.
- **Display name** is now "Agent CLI Menu" (spaces) in the app, menu bar, and docs. The cask token
  (`agentclimenu`), repo, and bundle id are unchanged.

## [0.1.1] — 2026-06-05

### Fixed

- **GUI launch shortcut is now a recorder.** The Settings field used to require typing the spec
  by hand (`cmd+shift+m`); you can now click it and press the combo. Only shortcuts the app can
  actually register are accepted, and Esc clears it.

## [0.1.0] — 2026-06-05

First public release. Agent CLI Menu merges two tools — the `cld` project launcher and the
`ccsm` session manager — into one, with a native macOS GUI.

### Added

- **New-session launcher** (`cld` / the New tab): grouped project directories, frecency sort
  (`z`, falls back to mtime), fuzzy filter, per-row git branch, and one-key open-in-IDE / tmux /
  `git pull` / Finder / new-directory.
- **Resume** (`ccsm` / the Resume tab): fuzzy-search every Claude Code session by name, path, or
  id; full-text search across transcripts; an inline transcript **peek** (side-by-side on wide
  terminals); and a cwd-confidence gate that warns before resuming into an uncertain directory.
- **Unified TUI**: `cm` opens the menu (New ⇄ Resume via `⇥`, tool cycle via `⇧⇥`), with a `?`
  help overlay and a windowed viewport for long lists.
- **Native macOS GUI** (`gui/`): a SwiftUI menu-bar + window app — keyboard-driven picker
  (custom search field with arrow/enter/esc/tab handling), full-row selection, transcript preview
  pane, in-app config editor with color pickers, a configurable terminal, and a global hotkey.
- **Shared TOML config** at `~/.config/agentclimenu/config.toml`, edited by hand or in the GUI.
- Homebrew cask (`roypadina/tap/agentclimenu`) bundling the GUI app and the `cm`/`cld`/`ccsm` CLI.

[0.2.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.2.0
[0.1.1]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.1.1
[0.1.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.1.0
