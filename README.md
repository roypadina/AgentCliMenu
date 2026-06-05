<div align="center">

<img src="docs/screenshots/gui-resume.png" alt="AgentCliMenu — start a new Claude or Codex session in any project, or search and resume an existing one. A terminal menu plus a native macOS menu-bar GUI." width="720">

# AgentCliMenu

### One menu for every Claude & Codex session — start a new one in any project, or search and resume an old one.

A fast launcher for coding-agent sessions: pick a project and start **`claude`** / **`codex`**, or
fuzzy-search and **resume** any past Claude Code session — with a live transcript preview. Ships as a
terminal menu (**`cm`** / **`cld`** / **`ccsm`**) **and** a native macOS menu-bar app that share one config.

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

AgentCliMenu is two halves of that workflow in one tool:

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
| ⌨️ **Two tabs, one keystroke** | Start in **New**; `⇥` flips to **Resume**; `⇧⇥` cycles the tool. Same model in TUI and GUI. |
| 🧰 **Your tools & IDEs** | Configure any agent command (`claude`, `codex`, …) and `^`-key IDE binds (VS Code, Rider, …). |
| 🪄 **tmux / pull / Finder / new-dir** | One-key open-in-tmux, `git pull` first, reveal in Finder, or make a new directory anywhere. |
| 🖥️ **Native Mac GUI** | A SwiftUI menu-bar app — keyboard-driven picker, transcript preview, in-app config editor, global hotkey. |
| 🤝 **Shared config** | One TOML file drives both the terminal and the GUI. Edit it by hand or in the GUI's Settings. |
| 🔐 **No cloud, no telemetry** | Reads local files only. No accounts, no analytics, no network calls of its own. |

## Screenshots

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
 ccsm    24 sessions  ·  3 active  ·  2/24
 ● busy   ● idle   ○ inactive

 ▶ ● AgentCliMenu — GUI keyboard nav            p peek
     a1b2c3d4   updated Jun 5 17:30 (2m)   started Jun 5 13:06
     ~/Code/Padina/AgentCliMenu   ⎇ main
   ○ Recover Edge profiles after crash
     9f8e7d6c   updated Jun 4 22:11 (19h)  started Jun 4 21:40
     ~/Code/Padina/LanGuard-app   ⎇ main
   ▼ 22 more below

 ↑/↓ move  ·  enter resume  ·  p peek  ·  / filter  ·  s search  ·  r refresh  ·  ? help  ·  q quit
```

## Install

> **Requires macOS 12+** and **Node 18+** (the terminal menu runs on Node; the GUI bundles its CLI and depends on Node via Homebrew).

### Homebrew (GUI app + `cm` / `cld` / `ccsm` CLI, one install)

```bash
brew install --cask roypadina/tap/agentclimenu
```

This installs **AgentCliMenu.app** (the menu-bar GUI) and puts **`cm`**, **`cld`**, and **`ccsm`** on your `PATH`.

> AgentCliMenu is ad-hoc signed (not notarized). On first launch, **right-click AgentCliMenu in
> `/Applications` → Open** (then Open again), or run once:
> ```bash
> xattr -dr com.apple.quarantine "/Applications/AgentCliMenu.app"
> ```
> See [Is it safe?](#is-it-safe).

### From source

```bash
git clone https://github.com/roypadina/AgentCliMenu.git
cd AgentCliMenu
npm install
npm run build
npm link            # puts cm / cld / ccsm on your PATH

# optional: build the Mac GUI
bash gui/build-app.sh
open gui/AgentCliMenu.app
```

First run sets up a starter config: `cm config --setup`.

## The terminal menu

Three commands, same tool — they just open on a different tab:

| Command | Opens on | Equivalent to |
|---|---|---|
| **`cm`** | New (with `⇥` to Resume) | the full menu |
| **`cld`** | New | the old `cld` launcher |
| **`ccsm`** | Resume | the old session manager |

Plus non-interactive subcommands:

```bash
cm ls [--cwd <path>] [--active] [--json] [--sort updated|started|name] [--limit N]
cm peek <id> [--full] [--head N --tail N]      # print a transcript
cm resume <id> [--yes] [--cwd <override>]      # resume by id (prefix ≥ 4 chars)
cm path <id>                                   # print the .jsonl path
cm config --setup | --edit | --path            # manage the shared config
```

### Keys

**New** — `↑/↓` move · type to fuzzy-filter · `↵` launch · `⇥` Resume · `⇧⇥` cycle tool · `^n` new dir ·
`^t` tmux · `^p` pull · `^f` Finder · `^`-key IDEs · `?` full keymap · `esc` back.

**Resume** — `↑/↓` (or `j/k`) move · `↵` resume · `p` peek · `/` fuzzy-filter · `s` full-text search ·
`r` refresh · `⇥` New · `?` help · `q` quit. A `⚠` marks a session whose working directory couldn't be
decoded with confidence — `↵` twice to resume anyway.

## The Mac GUI

A SwiftUI menu-bar agent (look for **✦** in the menu bar). Click it for the popover, or detach into a
resizable window. It's a thin view over the same `cm` back-end — it never parses your config or reads
`~/.claude` itself.

- **Fully keyboard-driven** — type to filter, `↑/↓` to select, `↵` to launch/resume, `⇥` to switch tabs,
  `esc` to clear or close. The search field keeps focus the whole time.
- **Transcript preview** — toggle the side pane in Resume to read a session before resuming.
- **In-app Settings** — edit groups (with color pickers), tools, IDE binds, the terminal to open
  sessions in, and a **global hotkey** to summon the window. Saves to the same TOML the terminal reads.
- **Configurable terminal** — open sessions in the system default, or in Terminal / iTerm / Ghostty /
  Warp / kitty / WezTerm / cmux, or a custom command.

## Configuration

One TOML file, shared by the terminal and the GUI:

```
$AGENTCLIMENU_CONFIG  →  $XDG_CONFIG_HOME/agentclimenu/config.toml  →  ~/.config/agentclimenu/config.toml
```

`cm config --setup` writes a starter; `cm config --edit` opens it; the GUI's **Settings** edits the same file.
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
| **`gui/`** | A native SwiftUI menu-bar + window app. A thin client over `cm gui …` (JSON in, launch out) — it imports none of the Node code and re-reads nothing. |

Session names come from the transcript in priority order: a `/rename` custom title → an auto-generated
title → the first user prompt. Status (`busy`/`idle`/`inactive`) is derived from a live PID file plus a
`kill -0` / `ps` check. Working directories are decoded from Claude Code's ambiguous `-`-encoded folder
names by walking the filesystem — and flagged when the result isn't certain.

See [`CLAUDE.md`](CLAUDE.md) for the full module map.

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

If AgentCliMenu saves you some clicks and tab-hunting, you can
[**buy me a coffee on Ko-fi ☕**](https://ko-fi.com/roypadina) — totally optional, always appreciated.
A **⭐ star** helps just as much.

## License

[MIT](LICENSE) © Roy Padina
