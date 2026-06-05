# AgentCliMenu — implementation plan

Merge the **cld** zsh project-launcher and **ccsm** session-manager into one publishable Node/TS + ink tool. Built by extending this repo (cloned from ccsm, history preserved). ESM-only, `moduleResolution:Bundler` (`.js` import extensions), hard `src/core/` (no ink) ↔ `src/cli/` split.

Top-level UX: a root chooser **New session** vs **Resume session** (equal footing), each its own screen. Commands: `cm` → root, `cld` → New, `ccsm` → Resume (+ existing `ls`/`peek`/`resume`/`path`). Config in `~/.config/agentclimenu/config.toml`. Mac menu-bar GUI opens a configurable terminal running `cm`.

Derived from a 20-agent understand→design→adversarial-review→synthesize workflow (2026-06-05). Key facts verified against live source / ink 5.2.1.

## Blocker resolutions (drive the build)

| # | Issue | Resolution |
|---|---|---|
| B1 | ink→spawn handoff | ink 5.2.1 `unmount()` is **synchronous** (raw-mode + cursor restored before return) — verified in ink source. The real bug is **stdin type-ahead drain** (`handleReadable` while-loops `stdin.read()`). Fix = **deferred-launch chokepoint**: screens never `spawnSync` in `useInput`; they set a module-level `pendingLaunch` + `exit()`. Runner does `await waitUntilExit()` → `await setImmediate` → `stdin.pause()`+`setRawMode(false)`+show-cursor → `spawnSync(stdio:inherit)` → `process.exit`. Fix existing `tui.tsx` the same way. |
| B2 | TOML lib | **`smol-toml`** (pure-ESM, maintained, TOML 1.0). Reject `@iarna/toml`. Justify in CLAUDE.md (TOML is core, not a one-off helper). |
| B3 | 3 bins (cm/cld/ccsm) | Don't sniff `basename(argv[1])` (unreliable through symlinks). Three real shim files, each `process.env.CM_ENTRY='root'|'new'|'resume'; import('../dist/cli.js')`. `main.ts` reads `CM_ENTRY`. |
| B4 | tool `runs`/IDE `cmd` exec | Spawn through shell `${SHELL:-/bin/zsh} -c <cmd>` (**`-c` not `-lc`** — no rc re-source). These are shell strings (flags/`$dir`/`&&`), like cld's `eval`. Never naive-split. |
| B5 | `$dir` var | Config references **lowercase `dir`** (`code "$dir"`). Inject `dir` (lowercase), shell-quoted. Test asserts the value reaches `code "$dir"`. |
| B6 | `cm` bootstrap for GUI | Swift probes fixed paths (`/opt/homebrew/bin/cm`, `/usr/local/bin/cm`, `~/.local/bin/cm`, `$(brew --prefix)/bin/cm`) before shelling out. `cmBin` resolved in cli layer, not `argv[1]`. |
| B7 | AppleScript injection | Pass command via argv: `osascript -e 'on run argv' -e '…do script (item 1 of argv)' -e 'end run' -- <cmd>`. Or temp-script + `open -a`. Never interpolate into a `do script "…"` literal. |
| B8 | config error bricks app | `loadConfig` throws `ConfigError` only on the `cm config`/`--setup`/`--edit` paths. Root + Resume never load config at top level. New catches `ConfigError` at its boundary → inline "press e to edit" panel. |
| B9 | `listSessions` cold start (~394ms + per-session `ps`) | Lazy per-screen: `cm new`/`cld` loads config + cheap `groupScan` only (no `listSessions`). Root paints immediately, counts fill async. Resume keeps `listSessions` but bounded-concurrency scan + **one batched `ps`** over all live pids. |
| B10 | dirty-count promised, unimplementable cheaply | v1 **branch-only** via `readGitBranch` (zero-spawn). Dirty count deferred; if added, lazy cli-layer `git status --porcelain -z` for highlighted row only, debounced. No dirty in core API. |
| B11 | brew build-at-install fragility / node drift | Prefer **ship-built-dist**: tag carries built `dist/` + pruned prod `node_modules`; formula does no `npm ci`. `depends_on "node"` runtime only. Source-build fallback pins `node@22` + regen lockfile. |
| B12 | reserved-key ownership | `validateConfig(raw, { reservedKeys })` takes the set as a param; New screen owns its keymap + passes it. Reserved collision = **warn + drop**, never throw. |

Reserved keys: `enter`, `ctrl-f`, `ctrl-p`, `ctrl-t`, `ctrl-n`.

## Phase 1 — Core + Config (pure, TDD)

Add under `src/core/config/`: `types.ts`, `paths.ts` (chain: `AGENTCLIMENU_CONFIG` → `$XDG_CONFIG_HOME/agentclimenu` → `~/.config/agentclimenu`; **drop `CLD_CONFIG`**), `defaults.ts`, `validate.ts`, `loadConfig.ts` (smol-toml, mtime+size cache, `ConfigError(5)` on TomlError, `ConfigError(6)` on shape, `clearConfigCache`, `getTool`). Add `src/core/groupScan.ts` (`listProjects`, `parseZDb` path|rank|time field 2 seconds, `sortGroup` z→mtime, optional `readGitBranch`, one-level, dangling-symlink guard, **no listSessions/ps/jsonl**). Add `src/core/launchSpec.ts` (pure planner: `planLaunch`, `resolveNewDir`, `defaultNewDirChoice`, `sanitizeTmuxName`; maps key→kind+steps mirroring cld dispatch).

Change: `package.json` name→`agentclimenu`, add `smol-toml`, `files` allowlist. Add root `config.example.toml` (cld schema). Update `CLAUDE.md`.

Tests: `config.test.ts`, `config.example.test.ts` (zero warnings), `groupScan.test.ts`, `launchSpec.test.ts`. Verify `npm test && npm run typecheck`.

## Phase 2 — TUI router + screens + actions

`src/cli/launch.ts` (executor + DI; shell `-c`, `dir` env+quoted, mkdir-first, tmux-not-found→`LaunchError`). `src/cli/router.tsx` (`runScreen`, the chokepoint, `setPendingLaunch`, esc-stack `App`, `exitOnCtrlC:false`). `src/cli/screens/{RootScreen,NewScreen,ResumeScreen}.tsx`. Shared `components/{Header,SearchBox,Footer}.tsx` + `theme.ts` lifted from `tui.tsx`. `src/cli/main.ts` (tsup entry; `CM_ENTRY`; commander). `bin/{cm,cld,ccsm}`. `src/cli/config.ts` (`runSetup` no rc edit, `runEdit`+`clearConfigCache`).

Change `index.ts`→`buildProgram()`; `tui.tsx`→`ResumeScreen` (handoff via chokepoint); `sessionRepo.ts`+`liveState.ts` B9 perf patch (same signatures); `tsup.config.ts` entry `main.ts`.

Tests: `launch.test.ts` (B5 dir lowercase+quoted), `router.test.ts` (one pending plan, executePlan once), `resume-confidence.test.ts`, ink-testing smokes, sessionRepo batched-ps. Manual real-tty: type-ahead test (B1), IDE/tmux/^n/resume/esc.

## Phase 3 — Homebrew packaging

`Formula/agentclimenu.rb` (private git url+tag+revision (tap formula); `depends_on node, :macos`; ship-built-dist install; three shims w/ absolute path + `CM_ENTRY`; `bin.install_symlink`; caveats: `cm config --setup`, remove old `source cld.zsh`). `package.json` bins. Verify `brew audit`, clean-sandbox install, all three argv0s dispatch. **No push** until explicit OK.

## Phase 4 — Mac GUI (menu-bar)

`src/core/guiConfig.ts` (pure) + `src/cli/guiConfigCmd.ts` (`cm gui-config --for <root|new|resume>` → JSON `{contractVersion,terminal,launchCommand,cmBin,configPath,invocation,warnings}`; cmBin resolved here). Swift `gui/AgentCliMenuBar/` (`NSStatusItem`, `LSUIElement`, probe `cm`, JSON-decode all-optional + contractVersion, argv-passed osascript launcher, `open -a` fallback, custom `{{cmd}}`). `[gui]` table in config.example. Ad-hoc signed like Cloney.

## Stays from ccsm unchanged
All `src/core/` data engine (types, paths, decode, jsonlScan, git `readGitBranch`, search, transcript; sessionRepo/liveState get B9 patch only). `resume.ts` (non-interactive path) as `LaunchDeps` template. `format.ts`, `render.ts`, `peek.ts`. ESM/tsup/lazy-chunk model. Sessions stay under `~/.claude` (honors `CCSM_HOME`); only launcher CONFIG moves to `~/.config/agentclimenu`. `--dangerously-skip-permissions` hardcoded; status semantics; tag-stripping; existing subcommands (back-compat under `ccsm`).

## Risks
Real-tty handoff is unit-untestable → mandatory manual type-ahead test before release. smol-toml is strict → surface `.line` on error; re-seed via `cm config --setup`. Shell-eval of user config = trusted (like `.zshrc`). `cld` sourced function shadows the new bin → migration caveat + future `cm doctor`. cwd-follow: a binary can't chdir parent shell → New returns to original pwd (optional zsh wrapper later).
