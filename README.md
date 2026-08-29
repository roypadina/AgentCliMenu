<div align="center">

<img src="docs/demo.gif" alt="Agent CLI Menu demo — fuzzy-filter your projects, switch to Resume, search a past Claude Code session, and peek its transcript before resuming." width="760">

# Agent CLI Menu

### One menu for every Claude & Codex session — start a new one in any project, or search and resume an old one.

A fast launcher for coding-agent sessions: pick a project and start **`claude`** / **`codex`**, or
fuzzy-search and **resume** any past Claude Code session — with a live transcript preview. Ships as a
terminal menu (**`agent-cli-menu`**, alias **`acm`**) **and** a native macOS menu-bar app that share one config.

[![macOS](https://img.shields.io/badge/macOS-12%2B-000000?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Swift](https://img.shields.io/badge/Swift-5.9-F05138?logo=swift&logoColor=white)](https://swift.org)
[![Homebrew](https://img.shields.io/badge/brew-roypadina%2Ftap-FBB040?logo=homebrew&logoColor=white)](https://github.com/roypadina/homebrew-tap)
[![Release](https://img.shields.io/github/v/release/roypadina/AgentCliMenu?logo=github&label=release)](https://github.com/roypadina/AgentCliMenu/releases/latest)
[![CI](https://github.com/roypadina/AgentCliMenu/actions/workflows/ci.yml/badge.svg)](https://github.com/roypadina/AgentCliMenu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?logo=opensourceinitiative&logoColor=white)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?logo=github)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/roypadina/AgentCliMenu?style=social)](https://github.com/roypadina/AgentCliMenu/stargazers)

</div>

---

## Table of Contents

- [Why](#why)
- [Features](#features)
- [Screenshots](#screenshots)
- [Install](#install)
- [The terminal menu](#the-terminal-menu)
- [Names, notes, flags and reminders](#names-notes-flags-and-reminders)
- [Several Claude accounts](#several-claude-accounts)
- [The Mac GUI](#the-mac-gui)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Is it safe?](#is-it-safe)
- [Uninstall](#uninstall)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Why

You start coding-agent sessions all day — `claude` here, `codex` there — and then you want to jump
back into one from yesterday but can't remember which folder it was in. Claude Code stores every
session under `~/.claude/`, but there's no good way to *find* one.

Agent CLI Menu is two halves of that workflow in one tool:

- **New** — pick a project directory (grouped, frecency-sorted, fuzzy-filtered) and launch your agent
  there. Open it in your IDE first, in tmux, after a `git pull`, or create a brand-new directory on the fly.
- **Resume** — fuzzy-search every Claude Code session by name, path, or **full transcript text**, preview
  the conversation, and resume it in its original working directory.

It's **local-only** — it reads `~/.claude/` and your project folders, and runs no network calls of its own.

## Features

| | |
|---|---|
| 🆕 **New-session launcher** | Grouped project dirs, frecency-sorted (`z`, falls back to mtime), fuzzy filter, git branch per row. |
| 🔁 **Resume anything** | Every Claude Code session, fuzzy-matched on name / path / id — or full-text searched across transcripts. |
| 👀 **Transcript peek** | Preview a session's conversation before resuming — inline in the terminal, side-pane in the GUI. |
| 🧠 **AI recap** | `r` summarizes a session (what it was doing, decisions, state, follow-ups) via `claude -p` on haiku, cached. Decide whether to resume without reading the whole transcript. |
| ⌨️ **Two tabs, one keystroke** | Start in **New**; `⇥` flips to **Resume**; `⇧⇥` cycles the tool. Same model in TUI and GUI. |
| 🧰 **Your tools & IDEs** | Configure any agent command (`claude`, `codex`, …) and `^`-key IDE binds (VS Code, Rider, …). |
| 🪄 **tmux / pull / Finder / new-dir** | One-key open-in-tmux, `git pull` first, reveal in Finder, or make a new directory anywhere. |
| 🖥️ **Native Mac GUI** | A SwiftUI menu-bar app — keyboard-driven picker, transcript preview, in-app config editor, global hotkey. |
| 🏷️ **Names, notes, flags, reminders** | Rename any session (as often as you like), pin a note to it, tag it `todo`, mark it done, or set a reminder — from the picker, the CLI, or from inside the session itself. |
| 👥 **Every Claude profile** | Run several accounts via `CLAUDE_CONFIG_DIR`? All of their sessions show up, live status included — and resume runs under the right profile instead of silently using the wrong account. |
| 🤝 **Shared config** | One TOML file drives both the terminal and the GUI. Edit it by hand or in the GUI's Settings. |
| 🔐 **No cloud, no telemetry** | Reads local files only. No accounts, no analytics, no network calls of its own. |

## Screenshots

> **The Mac menu-bar app** — start a new session, fuzzy-resume a past one with a transcript peek, then edit the shared config, all from the menu bar:
>
> <img src="docs/gui-demo.gif" alt="Agent CLI Menu menu-bar app cycling through the New project launcher, the Resume tab with a live transcript preview, and the Settings config editor." width="430">

> **The Mac GUI — Resume**, with the transcript preview pane open:
>
> <img src="docs/screenshots/gui-resume.png" alt="Resume tab: a fuzzy-searchable session list on the left with status dots and git branches, and a live transcript preview on the right." width="620">

<table>
<tr>
<td width="50%" valign="top">

**New** — grouped, frecency-sorted projects.

<img src="docs/screenshots/gui-new.png" alt="New tab: project directories grouped by section with a full-row keyboard selection highlight." width="100%">

</td>
<td width="50%" valign="top">

**Settings** — shared with the terminal.

<img src="docs/screenshots/gui-settings.png" alt="Settings: terminal picker, launch hotkey, groups with color pickers, tools, and IDE keybinds." width="100%">

</td>
</tr>
</table>

The terminal menu mirrors the same model — start in **New**, `⇥` to **Resume**:

```
 resume   24 sessions  ·  3 active  ·  2/24      ● busy  ● idle  ○ inactive
 ╭──────────────────────────────────────────────┬────────────┬──────────────╮
 │   SESSION                                      │ BRANCH     │ LAST USED    │
 ├──────────────────────────────────────────────┼────────────┼──────────────┤
 │ ▶ ● AgentCliMenu — GUI keyboard nav            │ main       │ 2m ago       │
 │   ○ Recover Edge profiles after crash          │ main       │ 19h ago      │
 │   ○ reeco-item-classifier POC                  │ poc/bert   │ 2d ago       │
 ╰──────────────────────────────────────────────┴────────────┴──────────────╯
 ╭ AgentCliMenu — GUI keyboard nav ─────────────────────────────────────────╮
 │ a1b2c3d4 · ● busy · ⎇ main                                                │
 │ started Jun 5 13:06 · last used Jun 9 17:30 (2m ago)                      │
 │ ~/Code/Padina/AgentCliMenu                                                │
 │ recap  • Redesigned Resume as a bordered table with a details pane.       │
 │        • Added an AI recap (claude -p · haiku, cached).                   │
 ╰───────────────────────────────────────────────────────────────────────────╯

 ↑/↓ move  ·  ⏎ resume  ·  r recap  ·  p peek  ·  / filter  ·  s search  ·  ? help  ·  q quit
```

## Install

> **Requires macOS 12+** and **Node 18+** (the terminal menu runs on Node; the GUI bundles its CLI and depends on Node via Homebrew).

### Homebrew (GUI app + `agent-cli-menu` CLI, one install)

```bash
brew install --cask roypadina/tap/agentclimenu
```

This installs **Agent CLI Menu.app** (the menu-bar GUI) and puts **`agent-cli-menu`** (plus the short alias **`acm`**) on your `PATH`.

> Agent CLI Menu is ad-hoc signed (not notarized). On first launch, **right-click Agent CLI Menu in
> `/Applications` → Open** (then Open again), or run once:
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Agent CLI Menu.app"
> ```
> See [Is it safe?](#is-it-safe).

### From source

```bash
git clone https://github.com/roypadina/AgentCliMenu.git
cd AgentCliMenu
npm install
npm run build
npm link            # puts agent-cli-menu + acm on your PATH

# optional: build the Mac GUI
bash gui/build-app.sh
open "gui/Agent CLI Menu.app"
```

First run sets up a starter config: `agent-cli-menu config --setup`.

## The terminal menu

`agent-cli-menu` opens the menu — **New** by default, `⇥` to **Resume** (or jump straight there with `-r`).
**`acm`** is a shorter alias for the exact same tool. Want `cld`/`cdx`-style per-tool shortcuts? Add your own aliases.

| Command | Opens |
|---|---|
| `agent-cli-menu` &nbsp;·&nbsp; `acm` | New-session menu (`⇥` to Resume) |
| `agent-cli-menu -r` &nbsp;·&nbsp; `acm -r` | Resume menu |

Plus non-interactive subcommands:

```bash
agent-cli-menu ls [--cwd <path>] [--active] [--json] [--sort updated|started|name] [--limit N]
agent-cli-menu peek <id> [--full] [--head N --tail N]   # print a transcript
agent-cli-menu recap <id> [--refresh]                   # AI summary of a session (cached)
agent-cli-menu resume <id> [--yes] [--cwd <override>]   # resume by id (prefix ≥ 4 chars)
agent-cli-menu path <id>                                # print the .jsonl path
agent-cli-menu config --setup | --edit | --path         # manage the shared config
```

### Keys

**New** — `↑/↓` move · type to fuzzy-filter · `↵` launch · `⇥` Resume · `⇧⇥` cycle tool · `^n` new dir ·
`^t` tmux · `^p` pull · `^f` Finder · `^`-key IDEs · `?` full keymap · `esc` back.

**Resume** — `↑/↓` (or `j/k`) move · `pgup/pgdn` page · `g/G` first/last · `↵` resume · `p` peek · `r` recap ·
`/` fuzzy-filter · `s` full-text search · `^r` refresh · `⇥` New · `?` help · `q` quit.
Annotate the highlighted session in place: `e` name · `n` note · `f` flags · `t` reminder · `d` done · `h` hide done.
Highlighting a row shows its full details + recap inline. A `!` marks a session whose working directory
couldn't be decoded with confidence — `↵` twice to resume anyway.

## Names, notes, flags and reminders

Sessions arrive named after your first prompt, which ages badly. Give them a real name — and everything
else you'd want to remember about them:

```bash
acm name  "billing spike"     # rename it; as many times as you like
acm note  "waiting on Dor"    # a note that shows under the row
acm flag  todo later          # tags; the picker's filter searches them
acm remind 2h                 # or 30m · 3d · tomorrow 9am · 17:00 · an ISO date
acm done                      # finished (--undo reopens); h hides done sessions
acm annotations               # everything you've annotated  (--due for what's come due)
```

Run inside a Claude session, they target **that** session — no id needed. From anywhere else, add
`-s <id-or-prefix>`. Rows show `✓` done, `⚑` flagged, `✎` noted, `◆` reminder (red once due).

It's stored in `~/.config/agentclimenu/annotations/<session-id>.json`, one small file per session,
deliberately outside `~/.claude` — nothing here can corrupt a transcript.

### From inside Claude Code

The [`acm-sessions` plugin](plugins/acm-sessions) adds `/acm-name`, `/acm-note`, `/acm-flag`,
`/acm-remind` and `/acm-done`, plus a `SessionStart` hook that hands each session its own name, note
and flags — and asks an unnamed one to name itself once the first task is clear.

```
/plugin marketplace add roypadina/AgentCliMenu
/plugin install acm-sessions@agent-cli-menu
```

## Several Claude accounts

Claude Code keeps each account in its own `CLAUDE_CONFIG_DIR` (`~/.claude`, `~/.claude2`, …). Agent CLI
Menu scans **all** of them, so every session is listed with the correct live status, and resuming pins
`CLAUDE_CONFIG_DIR` to the profile that session belongs to. To *start* new sessions on a given account,
add one tool per profile:

```toml
[[tool]]
name  = "work"
runs  = "CLAUDE_CONFIG_DIR=~/.claude2 claude --dangerously-skip-permissions"
label = " ⚡ Work account "
```

`⇧⇥` cycles between them.

## The Mac GUI

A SwiftUI menu-bar agent (look for **✦** in the menu bar). Click it for the popover, or detach into a
resizable window. It's a thin view over the same `agent-cli-menu` back-end — it never parses your config or reads
`~/.claude` itself.

- **Fully keyboard-driven** — type to filter, `↑/↓` to select, `↵` to launch/resume, `⇥` to switch tabs,
  `esc` to clear or close. The search field keeps focus the whole time. Clicking outside the window or
  pressing `esc` dismisses it (menu-bar-panel feel).
- **Details + recap on select** — highlight a session to see its full metadata (id, status, branch,
  started, **last used**, cwd) and a **Generate recap** button — an AI summary so you know what it was
  doing before you resume.
- **Transcript preview** — read a session's recent transcript on the right before resuming. Drag the
  divider to **resize** the list / preview split.
- **In-app Settings** — edit groups (with color pickers), tools, IDE binds, the terminal to open
  sessions in, and a **global hotkey** to summon the window. Saves to the same TOML the terminal reads.
- **Configurable terminal** — open sessions in the system default, or in Terminal / iTerm / Ghostty /
  Warp / kitty / WezTerm / cmux, or a custom command.

## Configuration

One TOML file, shared by the terminal and the GUI:

```
$AGENTCLIMENU_CONFIG  →  $XDG_CONFIG_HOME/agentclimenu/config.toml  →  ~/.config/agentclimenu/config.toml
```

`agent-cli-menu config --setup` writes a starter; `agent-cli-menu config --edit` opens it; the GUI's **Settings** edits the same file.
See [`config.example.toml`](config.example.toml) for every option. The shape:

```toml
default_tool = "cld"

[[group]]                       # a section in the New screen; `path` is scanned one level deep
name  = "Work"
path  = "~/code/work"
color = "#6C91BF"

[[tool]]                        # an agent launcher: `runs` is executed in the chosen dir
name  = "cld"
runs  = "claude --dangerously-skip-permissions"

[[ide]]                         # an fzf-style ^key that opens an editor, then the tool
key   = "ctrl-v"
label = "code"
cmd   = 'code "$dir"'

[gui]
terminal = "default"            # or Terminal | iTerm | Ghostty | Warp | kitty | WezTerm | cmux | custom
# hotkey = "cmd+shift+m"        # global shortcut to open the GUI window
```

## How it works

A clean two-layer split keeps the logic reusable and testable:

| Layer | Role |
|---|---|
| **`src/core/`** | Pure data — zero React/ink. Session scan & cwd-decode, streaming JSONL parse, live-PID status, git branch, fuzzy matcher, TOML config, project scanner, launch planner. Unit-tested. |
| **`src/cli/`** | The ink TUI (New + Resume tabs, peek, search) and the non-interactive subcommands. The only layer that touches presentation. |
| **`gui/`** | A native SwiftUI menu-bar + window app. A thin client over `agent-cli-menu gui …` (JSON in, launch out) — it imports none of the Node code and re-reads nothing. |

Session names come from the transcript in priority order: a `/rename` custom title → an auto-generated
title → the first user prompt. Status (`busy`/`idle`/`inactive`) is derived from a live PID file plus a
`kill -0` / `ps` check. Working directories are decoded from Claude Code's ambiguous `-`-encoded folder
names by walking the filesystem — and flagged when the result isn't certain.

📖 Full docs are in the **[Wiki](https://github.com/roypadina/AgentCliMenu/wiki)** (Installation · Commands · Configuration · GUI · Architecture · FAQ). See [`CLAUDE.md`](CLAUDE.md) for the contributor module map.

## Is it safe?

- **Open source (MIT).** Read or build every line yourself.
- **Local-only. No network calls of its own, no analytics, no accounts.** It reads `~/.claude/` and the
  project folders you configure, and launches your terminal. That's it.
- **`--dangerously-skip-permissions`.** The default tool commands include Claude's
  `--dangerously-skip-permissions` (and Codex's sandbox-bypass) flag, because this is a launcher for your
  own machine — it's how `cld` always worked. You can change `runs` in your config to drop it.
- **Ad-hoc signed, _not_ notarized.** macOS can't verify the developer, so the first launch of the GUI is
  blocked until you **right-click → Open** (or clear quarantine — see [Install](#install)). Notarization
  needs a paid Apple Developer ID; it's on the roadmap. Prefer not to trust a prebuilt binary? Build from source.

## Uninstall

```bash
brew uninstall --cask agentclimenu        # if installed via Homebrew
# or: npm unlink -g agentclimenu          # if installed from source via npm link

rm -rf ~/.config/agentclimenu             # forget config (optional)
```

## Contributing

PRs welcome! `main` is protected — fork, branch, add tests, and open a PR. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
npm test && npm run typecheck && npm run build   # the whole check
```

## Support

If Agent CLI Menu saves you some clicks and tab-hunting, you can
[**buy me a coffee on Ko-fi ☕**](https://ko-fi.com/roypadina) — totally optional, always appreciated.
A **⭐ star** helps just as much.

## License

[MIT](LICENSE) © Roy Padina
