# AgentCliMenu (`cm` / `cld` / `ccsm`)

Node.js + TypeScript CLI/TUI. One menu with two halves: **New** — start a new Claude/Codex session in a project dir (configurable groups, frecency sort, IDE/tmux/pull/new-dir keys — the old `cld` launcher); **Resume** — search + resume any existing Claude Code session under `~/.claude/` (the old `ccsm`). Commands: `cm` → root chooser, `cld` → New, `ccsm` → Resume. Local-only, no cloud. Built by merging `cld` (zsh) + `ccsm` into one publishable tool — see `docs/superpowers/plans/2026-06-05-agentclimenu.md`.

## Quick reference

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Run tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Run from source | `npx tsx src/cli/index.ts <args>` |
| Run built binary | `node bin/ccsm <args>` |
| Watch tests | `npm run test:watch` |
| Dev build watch | `npm run dev` |

`bin/ccsm` is the production entry — it just `import()`s `dist/cli.js`, so you must run `npm run build` before it works. For TS-direct runs use `npx tsx src/cli/index.ts`.

## Layout

```
src/core/                 zero ink/react imports — pure data
  types.ts                SessionRecord, ListOptions, LiveSession, TranscriptTurn
  paths.ts                ccsmHome / projectsDir / sessionsDir (honors CCSM_HOME)
  decode.ts               encoded-cwd → cwd, FS-verified recursive pruned search
  jsonlScan.ts            streaming scan: first prompt, custom-title, ai-title, first ts
  liveState.ts            ~/.claude/sessions/<pid>.json + kill -0 + ps comm check
  git.ts                  read .git/HEAD (or gitdir-file) → branch / short SHA
  search.ts               async generator full-text search across all sessions
  sessionRepo.ts          orchestrator: listSessions / getSession
  transcript.ts           JSONL → TranscriptTurn[] (default/full/head+tail modes)
  config/                 AgentCliMenu launcher config (TOML, smol-toml)
    types.ts              GroupConfig/ToolConfig/IdeConfig/ThemeConfig, ConfigError
    paths.ts              configPath chain + expandPath (~ / allowlisted $VAR)
    defaults.ts           DEFAULT_TOOLS (cld/cdx), DEFAULT_RESERVED_KEYS, DEFAULT_CONFIG
    validate.ts           validateConfig(raw, {reservedKeys}) → config + warnings
    loadConfig.ts         load+cache(mtime,size), getTool, clearConfigCache
  groupScan.ts            New-screen scanner: listProjects/parseZDb/sortGroup (z→mtime, no ps/jsonl)
  launchSpec.ts           pure launch planner: planLaunch/resolveNewDir/sanitizeTmuxName

src/cli/                  zero direct fs reads — goes through sessionRepo
  index.ts                commander entry, subcommands, default → TUI
  tui.tsx                 ink App (3-line cards, search, peek)
  render.ts               table renderer for `ls`
  peek.ts                 renderPeek(SessionRecord) → string
  resume.ts               chdir + spawnSync('claude', …, stdio:'inherit') — DI for tests
  format.ts               formatDate, timeAgo, truncEnd, truncMiddle

tests/                    vitest, fixture trees under tests/fixtures/
bin/ccsm                  Node shebang shim → dist/cli.js
docs/superpowers/
  specs/2026-05-22-claude-session-manager-design.md
  plans/2026-05-22-ccsm.md
```

## Conventions

- **ESM only**. `"type": "module"` in `package.json`. Import siblings as `'./foo.js'` (the `.js` extension is required even for `.ts` sources because of `"moduleResolution": "Bundler"`).
- **Two-layer split**: `src/core/` has zero React/ink imports; `src/cli/` is the only place that touches presentation. A future GUI will import `src/core/` as-is. Don't blur this.
- **Streaming, never load whole files**. JSONL sessions can be MB-scale. Use `readline.createInterface(createReadStream(...))` and `for await` lines. Early-exit when possible. The only function that scans to end is `scanJsonl` (needs latest custom-title/ai-title).
- **No defensive code at boundaries that aren't boundaries**. Internal calls trust each other. Validate only at FS reads / external JSON / process.argv.
- **TDD where it helps**. New `src/core/` modules ship with `tests/core/<name>.test.ts`. UI work in `tui.tsx` gets smoke tests only — full UX validation is manual in a real terminal.
- **Cwd encoding is ambiguous**. `~/.claude/projects/<encoded-cwd>/` uses `-` as both the leading marker and the path separator. Real `-` in segment names (e.g. `My-App-Repo`) collides. `decode.ts` recursively walks candidates with `existsSync` pruning. When no match, returns `cwdDecodeConfident: false` — UI must surface this and `resume` refuses without `--cwd <override>`.
- **`--dangerously-skip-permissions` is hardcoded** into `cli/resume.ts`. Never expose a config flag to remove it. Only `resume` adds it; `peek` / read paths never do.
- **Session names** come from JSONL in priority order: `type:custom-title.customTitle` (from `/rename`) → `type:ai-title.aiTitle` (auto-generated) → first user prompt (with tag stripping) → `(no prompt yet)`.
- **Status detection**: a session is `busy`/`idle` only when a matching `~/.claude/sessions/<pid>.json` file exists, `kill -0 <pid>` succeeds, and `ps -o comm= -p <pid>` matches `/claude/i`. Otherwise `inactive`.

## AgentCliMenu launcher conventions

- **Config lives at `~/.config/agentclimenu/config.toml`** (chain: `$AGENTCLIMENU_CONFIG` → `$XDG_CONFIG_HOME/agentclimenu` → `~/.config/agentclimenu`). `$CLD_CONFIG` is intentionally NOT honored — clean break from cld.
- **`smol-toml`** is the one justified extra dep (TOML is core to New, not a one-off helper). It is TOML-1.0 strict; lax cld configs may need a re-seed (`cm config --setup`).
- **Shell var is lowercase `dir`** — IDE `cmd` / tool `runs` reference `$dir` (matching cld's `eval`). The launch executor sets `dir` (lowercase), shell-quoted, and runs via `${SHELL:-/bin/zsh} -c` (NOT `-lc` — no rc re-source).
- **New rows show git branch only** (`readGitBranch`, zero-spawn). No dirty count (would require shelling out per row).
- **Reserved keys** (`enter ctrl-f ctrl-p ctrl-t ctrl-n`) are owned by the New screen and passed into `validateConfig`; a colliding `[[ide]].key` is dropped with a warning, never a throw.
- **ink→spawn handoff:** never `spawnSync` inside a `useInput` callback. Screens set a module-level pending launch + `exit()`; the runner `await waitUntilExit()`, drains stdin (`setImmediate` + `pause` + `setRawMode(false)`), then spawns. (ink 5.2.1 `unmount()` is synchronous; the real hazard is stdin type-ahead drain.)

## Don't

- Don't introduce a runtime dependency just for one helper. The dep list is intentionally tiny: `chalk`, `commander`, `ink`, `ink-text-input`, `react`, `smol-toml`. Anything else needs justification.
- Don't shell out for git info on the hot scan path — use `src/core/git.ts` (reads `.git/HEAD` directly). Spawning `git` is slow and noisy. (A future lazy dirty-count for the highlighted row only is the sole allowed exception.)
- Don't replace the ink TUI with a different framework on a whim. Future GUI lives outside, not inside.
- Don't add a global state library (zustand/redux/etc). Plain `useState` is enough; the TUI has one screen.
- Don't break the `src/core/` ↔ `src/cli/` boundary. If a core module needs to print colors, that's a CLI concern — refactor.

## Tag stripping (shared rule)

When deriving names or showing transcripts, strip these tag blocks (closed or open-to-EOF):

```
<command-message>...</command-message>
<command-name>...</command-name>
<system-reminder>...</system-reminder>
<local-command-caveat>...</local-command-caveat>
<local-command-stdout>...</local-command-stdout>
<local-command-stderr>...</local-command-stderr>
```

Keep inner content for: `<command-args>...</command-args>` (also when unclosed).

Then drop a leading `/word` or `/skill:command ` prefix from the first user prompt (used as name fallback).

## Status

- v0.1.0 tagged on `main`. Initial implementation merged from `feat/v1-implementation` and deleted.
- Subsequent work has been committed directly to `main` (no PR flow — single-user repo). If the project grows, switch to feature branches.
- No CI. Manual `npm test && npm run typecheck && npm run build` before any tag.

## Out of scope (deferred)

- Windows support (`~/.claude` location and `kill -0`/`ps` semantics differ).
- File-watcher / live auto-refresh (`r` key manual refresh only).
- True fuzzy match (current search is whitespace-split AND of case-insensitive substrings).
- Electron/Tauri/web GUI. (A native SwiftUI menu-bar + window GUI lives in `gui/` — the picker
  itself: New/Resume lists, new-dir, and a full config editor. It's a thin view over `cm gui …`
  (projects/sessions/new-dir/launch/resume/terminals/config-get/config-save) and never reads
  `~/.claude` or parses TOML itself. Sessions open in the configured terminal; config is shared
  with the TUI.)
- Session deletion, archival, tagging, favorites.
- Multi-window resume dispatch via Terminal.app / iTerm AppleScript.
