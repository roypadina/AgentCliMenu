import type { Command } from 'commander';
import { isReminderDue, readAllAnnotations, readAnnotation } from '../core/annotations.js';
import type { Annotation } from '../core/types.js';

// Entry points for the acm-sessions Claude Code plugin. A hook must NEVER break the session it
// runs in, so every path here exits 0 and prints nothing rather than throwing.

export interface HookDeps {
  annotation?: (id: string) => Annotation | null;
  all?: () => Map<string, Annotation>;
  now?: Date;
}

/** Hook payloads are external JSON: pull the id out defensively. */
export function parseSessionId(raw: string): string | null {
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    return typeof d.session_id === 'string' && d.session_id ? d.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Context injected at SessionStart: what this session is called and what is attached to it, so a
 * resumed session knows its own name, plus a nudge to name a brand-new one. Kept to a handful of
 * lines — it is paid for on every single session start.
 */
export function sessionStartContext(raw: string, deps: HookDeps = {}): string {
  const id = parseSessionId(raw);
  if (!id) return '';
  const readOne = deps.annotation ?? ((i: string) => readAnnotation(i));
  const readAll = deps.all ?? (() => readAllAnnotations());
  const now = deps.now ?? new Date();
  const a = readOne(id);
  const lines: string[] = [];

  if (a?.name) lines.push(`Agent CLI Menu calls this session "${a.name}".`);
  else {
    lines.push(
      'This session has no Agent CLI Menu name. Once the user\'s first task is clear, name it with' +
      ' `acm name "<3-5 words>"` — run it once, quietly, and do not ask permission or announce it.',
    );
  }
  if (a?.flags.length) lines.push(`Flags on it: ${a.flags.map(f => `#${f}`).join(' ')}.`);
  if (a?.note) lines.push(`Note saved on it: ${a.note.replace(/\s*\n\s*/g, ' / ')}`);
  if (a?.done) lines.push('It is marked done — if the user reopens the work, run `acm done --undo`.');
  if (isReminderDue(a ?? undefined, now)) lines.push('Its reminder is due: tell the user once, up front.');

  const dueElsewhere = [...readAll().values()].filter(x => x.sessionId !== id && isReminderDue(x, now));
  if (dueElsewhere.length > 0) {
    const names = dueElsewhere.slice(0, 3).map(x => x.name ?? x.sessionId.slice(0, 8)).join(', ');
    lines.push(`${dueElsewhere.length} other session(s) have a reminder due (${names}). Mention this once.`);
  }

  lines.push(
    'Session tools, all targeting THIS session with no id needed: `acm name "…"`, `acm note "…"`,' +
    ' `acm flag <tag>`, `acm remind 2h`, `acm done`. Use them whenever the user asks to name, flag,' +
    ' annotate, remind about, or close out this session.',
  );
  return lines.join('\n') + '\n';
}

function readStdin(): Promise<string> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) { resolve(''); return; }
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(''));
  });
}

export function registerHookCommands(program: Command) {
  const hook = program
    .command('hook')
    .description('entry points for the acm-sessions Claude Code plugin (hook JSON on stdin)');

  hook
    .command('session-start')
    .description('print SessionStart context: this session\'s name, note, flags and due reminders')
    .action(async () => {
      try {
        process.stdout.write(sessionStartContext(await readStdin()));
      } catch {
        // never break the session that ran us
      }
    });
}
