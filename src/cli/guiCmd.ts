import { writeFileSync, chmodSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { loadConfig, getTool } from '../core/config/loadConfig.js';
import { listProjects } from '../core/groupScan.js';
import { listSessions, getSession } from '../core/sessionRepo.js';
import { planTerminal, resolveCustomTemplate } from '../core/terminalLaunch.js';
import { setGuiTerminal } from './config.js';
import type { ClaudeMenuConfig } from '../core/config/types.js';

const SHELL = process.env.SHELL ?? '/bin/zsh';

/** Known terminals offered in the GUI settings picker (+ "default" and "custom"). */
const KNOWN_TERMINALS: Array<{ id: string; label: string; appPaths: string[] }> = [
  { id: 'default', label: 'System default', appPaths: [] },
  { id: 'Terminal', label: 'Terminal', appPaths: ['/System/Applications/Utilities/Terminal.app', '/Applications/Utilities/Terminal.app'] },
  { id: 'iTerm', label: 'iTerm2', appPaths: ['/Applications/iTerm.app'] },
  { id: 'Ghostty', label: 'Ghostty', appPaths: ['/Applications/Ghostty.app'] },
  { id: 'Warp', label: 'Warp', appPaths: ['/Applications/Warp.app'] },
  { id: 'kitty', label: 'kitty', appPaths: ['/Applications/kitty.app'] },
  { id: 'WezTerm', label: 'WezTerm', appPaths: ['/Applications/WezTerm.app'] },
  { id: 'cmux', label: 'cmux', appPaths: ['/Applications/cmux.app'] },
  { id: 'custom', label: 'Custom command…', appPaths: [] },
];

function spawnDetached(cmd: string, args: string[]): void {
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.unref();
}

/** Open `command` in the configured terminal, running in `cwd`. */
export function openSession(command: string, cwd: string, config: ClaudeMenuConfig): void {
  const plan = planTerminal({
    terminal: config.gui.terminal,
    customTemplate: config.gui.launchCommand,
    command,
    cwd,
  });
  const dir = mkdtempSync(join(tmpdir(), 'claudemenu-'));
  const script = join(dir, 'launch.command');
  writeFileSync(script, plan.scriptBody);
  chmodSync(script, 0o755);

  if (plan.mode === 'default') {
    spawnDetached('open', [script]);
  } else if (plan.mode === 'app') {
    spawnDetached('open', ['-a', plan.appName ?? 'Terminal', script]);
  } else {
    const line = resolveCustomTemplate(plan.customTemplate ?? '', {
      script,
      cmd: `cd ${JSON.stringify(cwd)} && ${command}`,
      dir: cwd,
    });
    if (line.trim()) spawnDetached(SHELL, ['-c', line]);
    else spawnDetached('open', [script]); // empty custom template → fall back to default
  }
}

export function registerGuiCommands(program: Command): void {
  const gui = program.command('gui').description('GUI back-end (internal JSON + launch commands)');

  gui.command('projects')
    .description('list configured groups + their project dirs as JSON')
    .action(async () => {
      const { config } = loadConfig();
      const grouped = await listProjects(config.groups, { withGit: true });
      const out = config.groups.map((g, i) => ({
        name: g.name,
        color: g.color,
        path: g.path,
        dirs: (grouped[i] ?? []).map((d) => ({
          name: d.name, path: d.path, branch: d.gitBranch ?? null, timeMs: d.timeMs, scoreSource: d.scoreSource,
        })),
      }));
      console.log(JSON.stringify({ groups: out, tools: config.tools.map(t => ({ name: t.name, label: t.label.trim() })), defaultTool: config.defaultTool }));
    });

  gui.command('sessions')
    .description('list resumable sessions as JSON')
    .action(async () => {
      const records = await listSessions();
      console.log(JSON.stringify(records.map((r) => ({
        id: r.id, name: r.name, cwd: r.cwd, status: r.status, active: r.active,
        gitBranch: r.gitBranch ?? null, cwdConfident: r.cwdDecodeConfident,
        lastUpdatedAt: r.lastUpdatedAt.toISOString(),
      }))));
    });

  gui.command('new-dir')
    .description('mkdir -p <base>/<name>, print the path as JSON')
    .requiredOption('--base <dir>')
    .requiredOption('--name <name>')
    .action((opts: { base: string; name: string }) => {
      const path = join(opts.base, opts.name);
      mkdirSync(path, { recursive: true });
      console.log(JSON.stringify({ path }));
    });

  gui.command('launch')
    .description('open the tool in <dir> in the configured terminal')
    .requiredOption('--dir <dir>')
    .option('--tool <name>')
    .action((opts: { dir: string; tool?: string }) => {
      const { config } = loadConfig();
      const tool = getTool(config, opts.tool ?? config.defaultTool);
      openSession(tool.runs, opts.dir, config);
      console.log(JSON.stringify({ ok: true, dir: opts.dir, tool: tool.name }));
    });

  gui.command('resume')
    .description('resume a session in the configured terminal')
    .requiredOption('--id <id>')
    .action(async (opts: { id: string }) => {
      const { config } = loadConfig();
      const matches = await getSession(opts.id);
      if (matches.length !== 1) {
        console.log(JSON.stringify({ ok: false, error: matches.length === 0 ? 'not found' : 'ambiguous' }));
        process.exit(matches.length === 0 ? 1 : 2);
      }
      const s = matches[0];
      const bin = process.env.CCSM_CLAUDE_BIN ?? 'claude';
      openSession(`${bin} --resume ${s.id} --dangerously-skip-permissions`, s.cwd, config);
      console.log(JSON.stringify({ ok: true, id: s.id, cwd: s.cwd }));
    });

  gui.command('set-terminal <value>')
    .description('set [gui].terminal (value = "default" | app name | "custom")')
    .option('--command <template>', 'launch_command template for "custom"')
    .action((value: string, opts: { command?: string }) => {
      const p = setGuiTerminal(value, opts.command);
      console.log(JSON.stringify({ ok: true, terminal: value, configPath: p }));
    });

  gui.command('terminals')
    .description('list terminal options for the settings picker (with installed flag)')
    .action(() => {
      const { config } = loadConfig();
      const out = KNOWN_TERMINALS.map((t) => ({
        id: t.id, label: t.label,
        installed: t.appPaths.length === 0 ? true : t.appPaths.some((p) => existsSync(p)),
        selected: config.gui.terminal === t.id,
      }));
      console.log(JSON.stringify({ terminals: out, current: config.gui.terminal, customCommand: config.gui.launchCommand ?? null }));
    });
}
