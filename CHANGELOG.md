# Changelog

All notable changes to AgentCliMenu are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.1.0] — 2026-06-05

First public release. AgentCliMenu merges two tools — the `cld` project launcher and the
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

[0.1.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.1.0
