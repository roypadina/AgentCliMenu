import chalk from 'chalk';
import { homedir } from 'node:os';
import { formatDate, timeAgo, truncEnd, truncMiddle } from './format.js';
import { isReminderDue } from '../core/annotations.js';
import type { SessionRecord, SessionStatus } from '../core/types.js';

const STATUS_DOT: Record<SessionStatus, string> = {
  busy: chalk.green('●'),
  idle: chalk.yellow('●'),
  inactive: chalk.gray('○'),
};

function tildify(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '');
}

/** Same marks as the TUI: done · flagged · noted · reminder (red once due). */
function badges(r: SessionRecord): string {
  const a = r.annotation;
  if (!a) return '';
  return [
    a.done ? chalk.green('✓') : '',
    a.flags.length ? chalk.yellow('⚑') : '',
    a.note ? chalk.cyan('✎') : '',
    a.remindAt ? (isReminderDue(a) ? chalk.red('◆') : chalk.magenta('◆')) : '',
  ].join('');
}

export function renderTable(records: SessionRecord[]): string {
  if (records.length === 0) return chalk.dim('(no sessions)');
  const now = new Date();
  const cols = process.stdout.columns ?? 120;
  const maxNameW = Math.max(30, Math.min(70, Math.floor(cols * 0.40)));
  const maxCwdW = Math.max(20, Math.min(50, Math.floor(cols * 0.30)));

  const headers = ['●', '', '', 'UPDATED', 'AGO', 'STARTED', 'NAME', 'CWD', 'BRANCH', 'ID'].map(h => chalk.bold.dim(h));
  const rows = records.map(r => [
    STATUS_DOT[r.status],
    r.kind === 'tool' ? chalk.gray('▸') : '',
    badges(r),
    chalk.cyan(formatDate(r.lastUpdatedAt, now)),
    chalk.yellow.dim(timeAgo(r.lastUpdatedAt, now)),
    chalk.blue(formatDate(r.startedAt, now)),
    chalk.bold.white(truncEnd(r.name, maxNameW)),
    chalk.green(truncMiddle(tildify(r.cwd), maxCwdW)),
    r.gitBranch ? chalk.magenta(truncEnd(r.gitBranch, 20)) : chalk.dim('—'),
    chalk.magenta(r.id.slice(0, 8)),
  ]);
  const widths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map(r => stripAnsi(r[i]).length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) =>
      c + ' '.repeat(Math.max(0, widths[i] - stripAnsi(c).length))
    ).join('  ');
  return [fmt(headers), ...rows.map(fmt)].join('\n');
}
