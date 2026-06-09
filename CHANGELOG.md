# Changelog

All notable changes to Agent CLI Menu are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.3.0] — 2026-06-09

### Added

- **Session recap.** Press `r` in Resume (or run `agent-cli-menu recap <id>`) to generate a short
  AI summary of a session — what it was working on, key decisions, current state, open follow-ups —
  so you can decide whether to resume it without reading the whole transcript. Runs `claude -p`
  with the cheap/fast **haiku** model (override with `CCSM_RECAP_MODEL`) on a token-capped head+tail
  excerpt, and caches the result to `~/.config/agentclimenu/recaps/<id>.md` so re-opening is instant.
  `^r` now refreshes the session list; `r` recaps. The GUI gets a **Generate recap** button in the
  details pane.
- **Last-used timestamp** shown for every session in both the TUI and GUI.
- **Always-on details pane.** Highlighting a session now shows its full metadata (id, status, branch,
  started, last used, cwd) plus the recap — in the TUI, and in the GUI when a row is selected (no need
  to open it first).

### Changed

- **Redesigned Resume + New as bordered tables** — aligned columns (name · branch · last-used / age),
  far more readable than the old stacked cards.
- **GUI window dismissal** — clicking outside the window or pressing `esc` now closes it (menu-bar-panel feel).
- **Resizable GUI split** — drag the divider between the session list and the preview/details pane.

### Fixed

- **Wrong session on resume.** The fuzzy matcher could return a scattered, negative-scoring
  subsequence match, so searching a name (e.g. "LanGuard") sometimes resumed an unrelated session.
  Matches below a relevance floor are now rejected (TUI and GUI fuzzy stay in parity).
- **`↵` did nothing in the TUI menu.** Resume/quit set the result but never exited ink, so the
  deferred resume never ran. Enter now resumes the highlighted session.
- **Wrong "started" time.** Session timestamps are ISO strings, but the JSONL scan only parsed
  numeric ones, so "started" fell back to the file ctime. ISO timestamps are now parsed correctly.
- **GUI search didn't filter** (stale install) and **GUI recap reported an opaque "exit 1"** — the
  back-end now always exits 0 and conveys success/failure in its JSON so the GUI shows the real reason.

## [0.2.1] — 2026-06-05

### Changed

- **App bundle renamed to `Agent CLI Menu.app`** (+ `CFBundleName` = "Agent CLI Menu") so Spotlight,
  Raycast, and Finder show the spaced display name instead of "AgentCliMenu". `brew upgrade --cask
  agentclimenu` swaps the bundle. Identifiers (`agentclimenu` token, repo, `com.agentclimenu.menubar`,
  `agent-cli-menu`/`acm` binaries) are unchanged.

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

[0.3.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.3.0
[0.2.1]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.2.1
[0.2.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.2.0
[0.1.1]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.1.1
[0.1.0]: https://github.com/roypadina/AgentCliMenu/releases/tag/v0.1.0
