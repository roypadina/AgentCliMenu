import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { loadConfig } from '../core/config/loadConfig.js';
import { configPath } from '../core/config/paths.js';
import { buildContract, type GuiEntry } from '../core/guiConfig.js';

/** Resolve a runnable cm: an installed bin on a fixed path, else dev `node <repo>/bin/cm`. */
function resolveCm(): { cmPath: string; runner: string } {
  const candidates = [
    '/opt/homebrew/bin/cm',
    '/usr/local/bin/cm',
    join(homedir(), '.local', 'bin', 'cm'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { cmPath: c, runner: '' };
  }
  // dev fallback: this file is bundled to <repo>/dist/cli.js → <repo>/bin/cm
  const here = dirname(fileURLToPath(import.meta.url));
  const repoBin = join(here, '..', 'bin', 'cm');
  if (existsSync(repoBin)) return { cmPath: repoBin, runner: 'node' };
  return { cmPath: 'cm', runner: '' }; // last resort: hope it's on PATH
}

export function registerGuiConfigCommand(program: Command): void {
  program
    .command('gui-config')
    .description('print the JSON contract the Mac GUI uses to launch a terminal (internal)')
    .option('--for <entry>', 'root | new | resume', 'root')
    .action((opts: { for?: string }) => {
      const entry: GuiEntry = opts.for === 'new' || opts.for === 'resume' ? opts.for : 'root';
      const { cmPath, runner } = resolveCm();
      let terminalRaw = 'Terminal';
      let customTemplate: string | undefined;
      try {
        const { config } = loadConfig();
        terminalRaw = config.gui.terminal;
        customTemplate = config.gui.launchCommand;
      } catch { /* config error → defaults; GUI still launches */ }
      const contract = buildContract({
        entry, cmPath, runner, terminalRaw, customTemplate, configPath: configPath(),
      });
      console.log(JSON.stringify(contract, null, 2));
    });
}
