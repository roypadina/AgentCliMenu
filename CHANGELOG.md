# Changelog

All notable changes to Agentctl are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.5.0] — 2026-08-29

### Changed — BREAKING

- **Renamed to `agentctl`.** One name everywhere, replacing the five the project used to ship
  (`Agent CLI Menu` / `AgentCliMenu` / `agentclimenu` / `agent-cli-menu` / `acm`). The command is
  now **`agentctl`**; `acm` and `agent-cli-menu` are gone — `acm` reads as AWS Certificate Manager
  to this audience, which was half the reason to rename. The cask is `roypadina/tap/agentctl`, the
  app is `Agentctl.app` (`com.roypadina.agentctl` — the old bundle id used a domain we don't own),
  and config lives in `~/.config/agentctl`.
- **Nothing is lost upgrading.** A pre-rename `~/.config/agentclimenu` is moved across on first
  run — config, annotations and recaps all live under it, so one rename carries every one of them —
  and each renamed env var still falls back to its old name (`AGENTCTL_CONFIG` → `AGENTCLIMENU_CONFIG`,
  `AGENTCTL_HOME` → `CCSM_HOME`, and so on). Shell aliases or Raycast/tmux binds pointing at `acm`
  do need updating, and the new bundle id means the global hotkey, Login Item and Accessibility
  grants have to be given to the app once more.

### Added

- **Labels** — link a session to a ticket, repo or topic (`agentctl label RD-12345 catalog`, or
  `--auto` to take the issue key straight from the git branch). Labels keep their case, are matched
  by the picker's filter, and filter the listing (`agentctl annotations --label RD-12345`). `l` in
  the TUI, pre-filled with the branch's issue key.
- **Due dates** — `agentctl due "friday 17:00"`, distinct from a reminder: a due date is when the
  work is due, and the session shows overdue once it passes. `u` in the TUI, `✱` badge, red when
  overdue.
- **A skill in the `agentctl-sessions` plugin** teaching Claude the whole toolset — to name and
  label sessions unprompted, to drive every command from plain requests, and to offer to install
  `agentctl` when it is missing instead of failing quietly. Plus `/agentctl-label` and
  `/agentctl-due` commands, and a `SessionStart` hook that now reports labels, due dates and the
  issue key it found in your branch.

## [0.4.0] — 2026-08-29

### Added

- **Names, notes, flags, done and reminders on any session.** Rename a session as often as you like
  (`e`), pin a note to it (`n`), tag it (`f`), set a reminder (`t`), mark it finished (`d`) and hide
  finished ones (`h`) — or from the shell with `agentctl name/note/flag/remind/done/annotations`. Run
  inside a Claude session those commands target *that* session with no id. Rows show `✓ ⚑ ✎ ◆`
  badges (the reminder turns red once due) and the fuzzy filter searches flags and notes.
  Everything lives in `~/.config/agentctl/annotations/<id>.json`, one file per session, written
  atomically and kept outside `~/.claude` so it can never corrupt a transcript.
- **`agentctl-sessions` Claude Code plugin** (`plugins/agentctl-sessions`) — `/agentctl-name`, `/agentctl-note`,
  `/agentctl-flag`, `/agentctl-remind`, `/agentctl-done`, and a `SessionStart` hook that hands each session its own
  name, note and flags back, reports reminders that came due, and asks an unnamed session to name
  itself once its first task is clear.
- **Multi-profile support.** Several Claude accounts via `CLAUDE_CONFIG_DIR` (`~/.claude`,
  `~/.claude2`, …) are all scanned, so their sessions appear with correct live status.
- **`±N` dirty count** on the highlighted New-screen row (#1) — one `git status` for the selection
  only, debounced and cached, never on the scan path.
- **`pgup`/`pgdn` and `g`/`G`** in Resume and New; `↑/↓` now works while the filter box is open.

### Fixed

- **Resuming used the wrong Claude account.** Resume inherited whatever `CLAUDE_CONFIG_DIR` was set,
  so a session found under one profile could be resumed under another — and when profiles share a
  `projects/` dir that *succeeds silently as the wrong account*. Resume now pins the profile the
  session actually belongs to.
- **Sessions running under a side profile showed as `inactive`.** Live status only looked in
  `~/.claude/sessions`; every `~/.claude*` profile is scanned now.
- **A held-down arrow scrolled one row.** ink parses only the first key of each stdin chunk, so five
  presses arriving together moved the cursor once. The full repeat count is applied now.
- **Full-text search rendered every hit at once**, blowing past the terminal and scrolling the header
  away. Results are windowed, with a position counter.
- **The list could push the header off screen** whenever a note, a recap, a prompt or the ▲/▼ hints
  appeared. Its height is derived from what is actually on screen, and a scrollbar shows position.
- **A long cwd shifted every column left** — ink was flex-shrinking the fixed cells.
- **Arrow keys felt dead right after filtering** (the cursor kept a stale index), and fast typing in
  the New filter dropped characters.

## [0.3.0] — 2026-06-09

### Added

- **Session recap.** Press `r` in Resume (or run `agentctl recap <id>`) to generate a short
  AI summary of a session — what it was working on, key decisions, current state, open follow-ups —
  so you can decide whether to resume it without reading the whole transcript. Runs `claude -p`
  with the cheap/fast **haiku** model (override with `AGENTCTL_RECAP_MODEL`) on a token-capped head+tail
  excerpt, and caches the result to `~/.config/agentctl/recaps/<id>.md` so re-opening is instant.
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

- **App bundle renamed to `Agentctl.app`** (+ `CFBundleName` = "Agentctl") so Spotlight,
  Raycast, and Finder show the spaced display name instead of "Agentctl". `brew upgrade --cask
  agentctl` swaps the bundle. Identifiers (`agentctl` token, repo, `com.roypadina.agentctl`,
  `agentctl`/`agentctl` binaries) are unchanged.

## [0.2.0] — 2026-06-05

### Changed (breaking)

- **Commands renamed.** The three separate commands `cm` / `cld` / `ccsm` are replaced by a single
  **`agentctl`** (short alias **`agentctl`**). It opens **New** by default; **`-r`** / **`--resume`**
  opens **Resume**. Want `cld`/`cdx`-style per-tool shortcuts? Add your own shell aliases. After
  `brew upgrade --cask agentctl`, the old `cm`/`cld`/`ccsm` symlinks are removed.
- **Display name** is now "Agentctl" (spaces) in the app, menu bar, and docs. The cask token
  (`agentctl`), repo, and bundle id are unchanged.

## [0.1.1] — 2026-06-05

### Fixed

- **GUI launch shortcut is now a recorder.** The Settings field used to require typing the spec
  by hand (`cmd+shift+m`); you can now click it and press the combo. Only shortcuts the app can
  actually register are accepted, and Esc clears it.

## [0.1.0] — 2026-06-05

First public release. Agentctl merges two tools — the `cld` project launcher and the
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
- **Shared TOML config** at `~/.config/agentctl/config.toml`, edited by hand or in the GUI.
- Homebrew cask (`roypadina/tap/agentctl`) bundling the GUI app and the `cm`/`cld`/`ccsm` CLI.

[0.3.0]: https://github.com/roypadina/Agentctl/releases/tag/v0.3.0
[0.2.1]: https://github.com/roypadina/Agentctl/releases/tag/v0.2.1
[0.2.0]: https://github.com/roypadina/Agentctl/releases/tag/v0.2.0
[0.1.1]: https://github.com/roypadina/Agentctl/releases/tag/v0.1.1
[0.1.0]: https://github.com/roypadina/Agentctl/releases/tag/v0.1.0
