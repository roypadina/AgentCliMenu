import { Command } from 'commander';
import { listSessions, getSession } from '../core/sessionRepo.js';

// Version is baked in at build time from package.json (tsup `define`), so it never drifts from a
// hardcoded literal. Running from source via tsx (no define) falls back to 'dev'.
declare const __AGENTCTL_VERSION__: string;
const PKG_VERSION = typeof __AGENTCTL_VERSION__ === 'string' ? __AGENTCTL_VERSION__ : 'dev';
import { renderTable } from './render.js';
import { renderPeek } from './peek.js';
import { resume, ResumeError } from './resume.js';
import { getRecap, RecapError } from '../core/recap.js';
import { registerConfigCommands } from './config.js';
import { registerGuiCommands } from './guiCmd.js';
import { registerAnnotateCommands } from './annotate.js';
import { registerHookCommands } from './hook.js';

export async function resolveId(prefix: string) {
  if (prefix.length < 4) {
    console.error('id prefix must be at least 4 characters');
    process.exit(2);
  }
  const matches = await getSession(prefix);
  if (matches.length === 0) {
    console.error('not found');
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`ambiguous prefix '${prefix}', matches:`);
    for (const m of matches) console.error(`  ${m.id}  ${m.name}`);
    process.exit(2);
  }
  return matches[0];
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('agentctl')
    .description('Agentctl — start a new Claude/Codex session in a project, or search + resume an existing one')
    .version(PKG_VERSION)
    .option('-r, --resume', 'open the Resume menu (default opens New)')
    .action(async (opts: { resume?: boolean }) => {
      const { runApp } = await import('./router.js');
      await runApp(opts.resume ? 'resume' : 'new');
    });

  program
    .command('ls')
    .option('--cwd <path>')
    .option('--active')
    .option('--json')
    .option('--sort <key>', 'updated|started|name', 'updated')
    .option('--hidden', 'list only hidden sessions')
    .option('--deleted', 'list only deleted sessions')
    .option('--all', 'list everything, hidden and deleted included')
    .option('--limit <n>', '', v => parseInt(v, 10))
    .action(async opts => {
      const records = await listSessions({
        cwd: opts.cwd, activeOnly: opts.active, sortBy: opts.sort, limit: opts.limit,
        view: opts.all ? 'all' : opts.deleted ? 'deleted' : opts.hidden ? 'hidden' : 'normal',
      });
      if (opts.json) {
        console.log(JSON.stringify(records.map(r => ({
          ...r,
          startedAt: r.startedAt.toISOString(),
          lastUpdatedAt: r.lastUpdatedAt.toISOString(),
        })), null, 2));
      } else {
        console.log(renderTable(records));
      }
    });

  program
    .command('peek <id>')
    .option('--full')
    .option('--head <n>', '', v => parseInt(v, 10))
    .option('--tail <n>', '', v => parseInt(v, 10))
    .action(async (id: string, opts) => {
      const s = await resolveId(id);
      console.log(await renderPeek(s, { full: opts.full, head: opts.head, tail: opts.tail }));
    });

  // resume with an id → resume that session; without an id → open the Resume menu.
  program
    .command('resume [id]')
    .option('--yes')
    .option('--cwd <path>')
    .action(async (id: string | undefined, opts) => {
      if (!id) { const { runApp } = await import('./router.js'); await runApp('resume'); return; }
      const s = await resolveId(id);
      try {
        resume(s, { yes: opts.yes, cwdOverride: opts.cwd });
      } catch (e) {
        if (e instanceof ResumeError) { console.error(e.message); process.exit(e.code); }
        throw e;
      }
    });

  program
    .command('new')
    .description('open the New-session launcher')
    .action(async () => { const { runApp } = await import('./router.js'); await runApp('new'); });

  program
    .command('path <id>')
    .action(async (id: string) => { const s = await resolveId(id); console.log(s.jsonlPath); });

  program
    .command('recap <id>')
    .description('summarize a session via claude -p (cached; --refresh to regenerate)')
    .option('--refresh', 'ignore the cache and regenerate')
    .action(async (id: string, opts: { refresh?: boolean }) => {
      const s = await resolveId(id);
      try {
        const r = await getRecap({ id: s.id, jsonlPath: s.jsonlPath }, { refresh: opts.refresh });
        console.log(r.text);
      } catch (e) {
        if (e instanceof RecapError) { console.error(e.message); process.exit(e.code); }
        throw e;
      }
    });

  registerAnnotateCommands(program);
  registerHookCommands(program);
  registerConfigCommands(program);
  registerGuiCommands(program);
  return program;
}

async function main() {
  // Bare `agentctl` → New; `-r`/`--resume` → Resume; both via the root action.
  await buildProgram().parseAsync(process.argv);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
