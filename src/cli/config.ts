import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Command } from 'commander';
import { configPath, exampleConfigPath } from '../core/config/paths.js';
import { clearConfigCache } from '../core/config/loadConfig.js';
import { upsertKeyInSection } from '../core/config/toml-edit.js';

/** Seed the config from the shipped example (no rc edits — the bins are installed by brew). */
export function runSetup(): void {
  const cfg = configPath();
  if (existsSync(cfg)) {
    console.log(`config already exists: ${cfg}`);
  } else {
    mkdirSync(dirname(cfg), { recursive: true });
    copyFileSync(exampleConfigPath(), cfg);
    console.log(`seeded config at ${cfg}`);
  }
  console.log('edit it with:  agentctl config --edit');
}

export function runEdit(): void {
  const editor = process.env.EDITOR ?? 'vi';
  spawnSync(editor, [configPath()], { stdio: 'inherit' });
  clearConfigCache();
}

/** Set [gui].terminal (and optionally launch_command) in the config, preserving the rest. */
export function setGuiTerminal(value: string, command?: string): string {
  const cfg = configPath();
  if (!existsSync(cfg)) {
    mkdirSync(dirname(cfg), { recursive: true });
    if (existsSync(exampleConfigPath())) copyFileSync(exampleConfigPath(), cfg);
    else writeFileSync(cfg, '');
  }
  let text = readFileSync(cfg, 'utf8');
  text = upsertKeyInSection(text, 'gui', 'terminal', value);
  if (command !== undefined) text = upsertKeyInSection(text, 'gui', 'launch_command', command);
  writeFileSync(cfg, text);
  clearConfigCache();
  return cfg;
}

export function registerConfigCommands(program: Command): void {
  program
    .command('config')
    .description('manage the Agentctl config')
    .option('--setup', 'create the config from the example')
    .option('--edit', 'open the config in $EDITOR')
    .option('--path', 'print the config path')
    .action((opts: { setup?: boolean; edit?: boolean; path?: boolean }) => {
      if (opts.path) { console.log(configPath()); return; }
      if (opts.setup) { runSetup(); return; }
      if (opts.edit) { runEdit(); return; }
      console.log(configPath());
    });
}
