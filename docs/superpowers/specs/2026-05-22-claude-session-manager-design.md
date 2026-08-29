# Claude Code Session Manager (`ccsm`) — Design

**Date:** 2026-05-22
**Status:** Approved — ready for implementation planning
**Owner:** Roy Padina
**Target repo:** `/Users/roypadina/Code/Padina/ccsm`

---

## 1. Problem

Claude Code stores every interactive session locally as a JSONL event log under `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`. There is no built-in way to browse, peek, or resume sessions across projects. The existing `claude --resume` flow requires the user to already be in the correct working directory and to know the session id.

`ccsm` is a small Node.js CLI (TUI-first) that lists every Claude Code session on the machine, lets the user peek at its contents without resuming, and resumes the chosen session in the correct folder with one keypress.

A future GUI may be added; this design separates a pure-data core from the CLI so that future work imports the core unchanged.

## 2. Goals & Non-goals

### Goals (v1)
- List every session on disk with: id, derived name, cwd, started-at, last-updated-at, active flag (busy / idle / inactive).
- Interactive TUI as the default UX (arrow nav, filter, peek, resume).
- Scriptable subcommands: `ls`, `peek`, `resume`, `path`.
- `peek` renders a human-readable transcript (user + assistant turns, tool noise hidden).
- `resume` opens the chosen session in the **same terminal**, in the correct cwd, with `--dangerously-skip-permissions`.
- Internal module boundary that lets a future GUI import `src/core/` as-is.

### Non-goals (v1)
- File-watcher / live auto-refresh.
- Fuzzy filter.
- Multi-window dispatch (Terminal.app / iTerm AppleScript).
- Session deletion, archival, tagging, favorites.
- Windows support (macOS primary, Linux secondary).
- Cloud `/rename` integration — no local rename storage exists; name is derived.
- GUI (deferred).

## 3. Storage discovery (what `ccsm` reads)

| Source | Purpose | Notes |
|---|---|---|
| `~/.claude/projects/<encoded-cwd>/<id>.jsonl` | Authoritative event log per session | Encoded cwd uses `-` as path separator (`-Users-roy-Code` → `/Users/roy/Code`). Real `-` in path is ambiguous; mitigated by FS-verification (§5.1). |
| `~/.claude/sessions/<pid>.json` | Live process registry — only exists while the process is alive | Fields observed: `pid`, `sessionId`, `cwd`, `startedAt` (epoch ms), `updatedAt` (epoch ms), `status: "busy" \| "idle"`, `version`, `kind`, `entrypoint`, `bridgeSessionId`. Authoritative cwd source. |
| `~/.claude.json` → `projects.<cwd>.lastSessionFirstPrompt` | Only stores the last session per project | Not used — we scan the JSONL directly so all sessions are covered uniformly. |

### Name derivation
Stream the JSONL top-down; the name is the first event where `type === "user"` and `message.content` is a string (or contains a `text` block). Apply, in order:
1. Strip `<command-message>...</command-message>`.
2. Strip `<command-name>...</command-name>`.
3. Strip a leading `<command-args>` wrapper and its closing tag.
4. Strip `<system-reminder>...</system-reminder>` blocks.
5. Collapse whitespace; trim.
6. Truncate to 80 characters with a trailing `…` if cut.
Fallback when no user prompt yet: `"(no prompt yet)"`.

### Date derivation
- `startedAt`: prefer `~/.claude/sessions/<pid>.json` `startedAt` if live; else file `ctime`; else first timestamped event in the JSONL.
- `lastUpdatedAt`: prefer `~/.claude/sessions/<pid>.json` `updatedAt` if live; else file `mtime`.

### IsActive
A session is active iff:
1. A `~/.claude/sessions/<pid>.json` file exists whose `sessionId` matches, **and**
2. `kill -0 <pid>` succeeds (PID-recycle guard), **and**
3. The process's command name (via `ps -o comm= -p <pid>`) matches `/claude/i`.

If active, `status` is taken from the registry file (`busy` | `idle`). Otherwise the session is `inactive`.

## 4. Data model

```ts
// src/core/types.ts
export type SessionStatus = 'busy' | 'idle' | 'inactive';

export interface SessionRecord {
  id: string;                  // UUID, file stem
  name: string;                // derived; ≤ 80 chars
  cwd: string;                 // decoded absolute path
  cwdDecodeConfident: boolean; // false if dash-decode ambiguous
  jsonlPath: string;           // absolute
  sizeBytes: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  active: boolean;
  status: SessionStatus;
  pid?: number;                // present iff active
  version?: string;            // from sessions/<pid>.json
}

export interface ListOptions {
  cwd?: string;                // filter to one project cwd
  activeOnly?: boolean;
  sortBy?: 'updated' | 'started' | 'name';
  limit?: number;
}
```

## 5. Module layout (single package, internal boundary)

```
src/core/                 // zero ink/react imports
  types.ts                // shapes above
  paths.ts                // resolves ~/.claude; supports AGENTCTL_HOME env override
  decode.ts               // encoded-cwd → cwd, with FS verification (§5.1)
  liveState.ts            // reads ~/.claude/sessions/*.json + kill -0 + ps check
  jsonlScan.ts            // streaming scan: first prompt, first/last timestamps
  sessionRepo.ts          // listSessions(opts), getSession(id) — orchestrator
  transcript.ts           // jsonl → human transcript turns (used by CLI & TUI)

src/cli/                  // zero direct fs reads — goes through sessionRepo
  index.ts                // entrypoint, arg parsing (commander), dispatches subcommands
  tui.tsx                 // ink app (list, filter, peek pane, keybindings)
  render.ts               // column/table formatter for non-TUI `ls`
  resume.ts               // chdir + spawnSync('claude', …, { stdio: 'inherit' })
  peek.ts                 // streams transcript to stdout
```

### 5.1 Decode strategy
Encoded folder names use `-` as both the leading marker and the path separator, so a real `-` in a directory name (e.g. `My-App-Repo`) is ambiguous. Strategy:
1. Strip the leading `-`.
2. Generate the **most aggressive** candidate (every `-` → `/`).
3. If the candidate exists on disk, use it and set `cwdDecodeConfident: true`.
4. Otherwise, walk shorter prefixes (collapsing trailing `/` runs back to `-`) until a directory exists.
5. If none match, return the candidate as-is and set `cwdDecodeConfident: false`. The TUI marks these with a warning glyph; `resume` refuses without `--cwd <override>`.

### 5.2 `jsonlScan.ts`
Streams the JSONL line-by-line (`readline`) rather than loading whole files (some are >150 KB and a session may exceed several MB). It exits early as soon as it has the first user prompt and the first timestamped event — the last-updated timestamp is read from the file's `mtime` (§3), so a full read is not needed. Corrupt lines are skipped and counted; the count is exposed via `--verbose`.

### 5.3 `transcript.ts`
Produces an array of `TranscriptTurn { role, text, kind }`. The CLI's `peek.ts` renders to stdout; the TUI's peek pane reuses the same renderer into a string buffer.

| Line `type` | Default mode | `--full` mode |
|---|---|---|
| `user` w/ string `content` | strip command/system-reminder tags → `[user] <text>` | same |
| `user` w/ block array | emit `text` blocks; skip `tool_result` | emit `text`; summarize `tool_result` as `[tool-result: <name> ok\|err <500-char preview>]` |
| `assistant` w/ block array | emit `text` blocks | emit `text`; summarize `thinking` as `[thinking] <preview>`; summarize `tool_use` as `[tool: <name>(<arg-preview>)]` |
| `summary` (when present) | `[summary] <text>` | same |
| `last-prompt`, `permission-mode`, `attachment`, hook events | skip | summarized previews |

All tool / system content is truncated to 500 chars with `[…+N more]` even in `--full`.

## 6. CLI surface

Binary: `ccsm`.

```
ccsm                                # default → interactive TUI
ccsm ls [--cwd <path>] [--active] [--json] [--sort updated|started|name] [--limit N]
ccsm peek <id> [--full] [--head N --tail N]
ccsm resume <id> [--yes] [--cwd <override>]
ccsm path <id>                      # print absolute path to .jsonl
ccsm --version | --help
```

- `<id>` accepts a **unique prefix** (≥ 4 chars). Ambiguous prefix → exit 2 with the list of matches.
- `--json` on `ls` emits an array of `SessionRecord` with `Date`s as ISO strings.
- Default `ls` sort: `updated` descending.
- Active sessions are tagged in the TUI: 🟢 busy / 🟡 idle / ⚪ inactive (falls back to letters `B / I / -` if `NO_COLOR` or `CI` is set).
- Global flags: `--ccsm-home <path>` and env `AGENTCTL_HOME` override `~/.claude` (used in tests).
- Exit codes: `0` ok, `1` not found, `2` ambiguous prefix, `3` cwd missing on resume, `127` `claude` binary missing.

## 7. TUI flow (ink)

```
┌─ ccsm ─ 23 sessions ─────────────────────────────── filter: _____ ──┐
│ ● UPDATED        STARTED         NAME                        CWD     │
│ 🟢 2m ago        14:24            /superpowers:brainstorming…  ~/Code │
│ 🟡 12m ago       11:30            fix auth token expiry         ~/…/BE │
│ ⚪ 3h ago        09:55            "Senior FullStack assignmen…  ~/…/  │
│ ⚪ yesterday     yesterday        explore dataset shape         ~/…/  │
│ …                                                                    │
├──────────────── peek (press p to toggle) ──────────────────────────── │
│ [user] fix auth — token check uses < not <=                          │
│ [assistant] bug confirmed at auth.ts:42. patch:                      │
│ …                                                                    │
└─ enter resume · p peek · o open · / filter · r refresh · q quit ─────┘
```

### States and transitions

```
list  --↑/↓-->     list (move cursor)
list  --/-->       filtering
list  --p-->       peeking (loads transcript, renders in pane)
list  --Enter-->   confirming-resume (only if active+busy: warn "session busy, resume will attach")
list  --o-->       open cwd in Finder (`open <cwd>` on macOS, `xdg-open` on linux)
list  --c-->       copy id to clipboard (best-effort; `pbcopy`/`wl-copy`/`xclip` if available)
list  --r-->       list (re-scan)
any   --q/Esc-->   exit
```

### Libraries
- `ink` v5 + `ink-text-input` for the filter.
- Hand-rolled column layout (lighter than `ink-table`).
- Plain `useState` + a single `useEffect` for initial load. No state-management library.

### Filter
Case-insensitive substring match across `name + cwd + id`. Fuzzy is out of scope for v1.

### Refresh
Manual via `r`. No file-watcher in v1.

## 8. Resume mechanism

Same-terminal handoff:

```ts
// src/cli/resume.ts (sketch)
export async function resume(s: SessionRecord, opts: { yes?: boolean } = {}) {
  if (!s.cwd || !existsSync(s.cwd)) {
    throw new ResumeError(3, `session cwd missing: ${s.cwd ?? '(unknown)'}`);
  }
  if (s.active && s.status === 'busy' && !opts.yes) {
    // TUI: interactive confirm. CLI: require --yes.
  }
  const claudeBin = process.env.AGENTCTL_CLAUDE_BIN ?? 'claude';
  await unmountInkIfMounted();
  const child = spawnSync(
    claudeBin,
    ['--resume', s.id, '--dangerously-skip-permissions'],
    { cwd: s.cwd, stdio: 'inherit', env: process.env },
  );
  process.exit(child.status ?? 1);
}
```

Notes:
- Node has no true `execvp`. `spawnSync` with `stdio: 'inherit'` is functionally equivalent for an interactive TTY: ccsm hands the terminal to `claude`, waits, and exits with the child's status. The parent Node process stays in memory (~30 MB) for the duration of the session; acceptable.
- `--dangerously-skip-permissions` is hardcoded into `ccsm resume`; it is **never** added by `ccsm peek` or any read path. v1 has no config flag to remove it; this is per the user's explicit requirement.
- The TUI must unmount before `spawnSync` so the terminal is in a clean state for the child.

## 9. Error handling (at boundaries only)

| Boundary | Failure | Behavior |
|---|---|---|
| `~/.claude/projects` missing | First run, no Claude Code data | Friendly message; `ls --json` returns `[]`; exit 0. |
| Corrupt JSONL line | Malformed JSON | Skip line; increment counter; surface with `--verbose`. |
| Truncated JSONL (mid-write) | Active session | Streaming parser tolerates partial last line. |
| `kill -0` race | PID recycled to non-claude process | Cross-check `ps -o comm=`; if mismatch, mark inactive. |
| Ambiguous cwd decode | `cwdDecodeConfident: false` | Show best-guess with warning glyph in TUI; `resume` refuses without `--cwd <override>`. |
| `claude` binary missing | resume only | Exit 127 with message: `"claude not found on PATH (override via AGENTCTL_CLAUDE_BIN)"`. |

No defensive validation elsewhere — trust internal code.

## 10. Testing strategy

- **Unit (vitest):** `decode.ts`, `jsonlScan.ts` (fixtures: empty, single-turn, partial last line, malformed lines, with `<system-reminder>` blocks), `transcript.ts` (golden snapshots), `liveState.ts` (mocked fs + `kill -0` + `ps`).
- **Integration:** create a tmp directory tree, set `AGENTCTL_HOME=$tmp`, run `ccsm ls --json` and `ccsm peek <id>`, snapshot the output.
- **TUI smoke:** `ink-testing-library` to render the app, simulate keys, assert focused row and peek pane content.
- **Resume:** unit-test argv construction with a stubbed `spawnSync`. No real `claude` launch in tests.

## 11. Packaging & distribution

- Single npm package; `pnpm` workspace-ready but flat for v1.
- Build with `tsup`: `dist/cli.js` (ESM); `bin/ccsm` is a Node shebang that imports it.
- `package.json` essentials:
  ```json
  {
    "name": "ccsm",
    "type": "module",
    "bin": { "ccsm": "bin/ccsm" },
    "engines": { "node": ">=18" },
    "scripts": {
      "build": "tsup",
      "dev": "tsup --watch",
      "test": "vitest",
      "typecheck": "tsc --noEmit"
    }
  }
  ```
- Node 18+ required (`fs/promises`, `readline`, `structuredClone`).
- No native dependencies. Pure JavaScript.
- Distribution v1: `pnpm link --global` for personal use; npm publish later.
- Target platforms: macOS (primary), Linux (secondary). Windows deferred — `~/.claude` path, `kill -0`, and `ps` semantics differ.

## 12. Out of scope (deferred)

- File-watcher / live auto-refresh.
- Fuzzy filter.
- Multi-window resume dispatch via Terminal.app or iTerm AppleScript.
- GUI (Electron / Tauri / web).
- Session deletion, archival, tagging, favorites.
- Cloud `/rename` integration — no local storage exists.
- Windows support.

## 13. Open questions

None blocking. Confirmed during brainstorming:
- Runtime: Node.js + TypeScript.
- IsActive sourcing: from `~/.claude/sessions/<pid>.json` registry (free signal — was originally proposed to skip).
- Name source: first user prompt (no local `/rename` storage exists).
- UX: interactive TUI default.
- Resume: same-terminal handoff with `--dangerously-skip-permissions`.
- Peek format: human transcript (tool noise hidden).
- Repo location: `/Users/roypadina/Code/Padina/ccsm`.
