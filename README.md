# ccsm — Claude Code Session Manager

List, peek, and resume every Claude Code session on this machine.

## Install

```bash
npm install
npm run build
npm link
```

## Usage

```bash
ccsm                                                # interactive TUI
ccsm ls [--cwd <path>] [--active] [--json] [--sort updated|started|name] [--limit N]
ccsm peek <id> [--full] [--head N --tail N]
ccsm resume <id> [--yes] [--cwd <override>]
ccsm path <id>
```

`<id>` accepts a unique prefix (≥ 4 characters).

`resume` launches `claude --resume <id> --dangerously-skip-permissions` in the session's
working directory, replacing the current terminal.

## TUI keys

| Key | Action |
|---|---|
| ↑ / ↓ | Move cursor |
| `/` | Filter sessions |
| `p` | Peek selected session |
| `r` | Refresh from disk |
| Enter | Resume selected session |
| `q` / Esc | Quit |

## Environment

| Var | Purpose |
|---|---|
| `CCSM_HOME` | Override `~/.claude` (mostly for tests). |
| `CCSM_CLAUDE_BIN` | Override the `claude` binary path. |
| `NO_COLOR` | Disable colored output. |

## Status

v1 — macOS primary, Linux secondary. Windows not supported.

See `docs/superpowers/specs/2026-05-22-claude-session-manager-design.md` for the design
and `docs/superpowers/plans/2026-05-22-ccsm.md` for the implementation plan.
