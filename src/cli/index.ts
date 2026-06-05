import { Command } from 'commander';
import { listSessions, getSession } from '../core/sessionRepo.js';
import { renderTable } from './render.js';
import { renderPeek } from './peek.js';
import { resume, ResumeError } from './resume.js';
import { registerConfigCommands } from './config.js';
import { registerGuiCommands } from './guiCmd.js';
import type { Screen } from './router.js';

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
    .name('cm')
    .description('AgentCliMenu — new sessions in a project, or search + resume existing ones')
    .version('0.1.1');

  program
    .command('ls')
    .option('--cwd <path>')
    .option('--active')
    .option('--json')
    .option('--sort <key>', 'updated|started|name', 'updated')
    .option('--limit <n>', '', v => parseInt(v, 10))
    .action(async opts => {
      const records = await listSessions({
        cwd: opts.cwd, activeOnly: opts.active, sortBy: opts.sort, limit: opts.limit,
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

  registerConfigCommands(program);
  registerGuiCommands(program);
  return program;
}

async function main() {
  const entry = (process.env.CM_ENTRY as Screen) ?? 'root';
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const { runApp } = await import('./router.js');
    await runApp(entry === 'new' || entry === 'resume' ? entry : 'root');
    return;
  }
  await buildProgram().parseAsync(process.argv);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
