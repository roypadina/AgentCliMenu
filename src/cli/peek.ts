import chalk, { supportsColor } from 'chalk';
import { readTranscript, type TranscriptOptions } from '../core/transcript.js';
import type { SessionRecord, TranscriptRole } from '../core/types.js';

const COLOR: Record<TranscriptRole, (s: string) => string> = {
  user: chalk.cyan,
  assistant: chalk.green,
  system: chalk.dim,
  tool: chalk.yellow,
};

function wrap(text: string, indent: number, width: number): string {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para.length <= width) { out.push(para); continue; }
    let rest = para;
    while (rest.length > width) {
      out.push(rest.slice(0, width));
      rest = ' '.repeat(indent) + rest.slice(width);
    }
    out.push(rest);
  }
  return out.join('\n');
}

export async function renderPeek(
  s: SessionRecord,
  opts: TranscriptOptions = {},
): Promise<string> {
  const turns = await readTranscript(s.jsonlPath, opts);
  const cols = process.stdout.columns ?? 100;
  const header = [
    `Session ${s.id}  ${s.cwd}`,
    `started ${s.startedAt.toISOString()}  updated ${s.lastUpdatedAt.toISOString()}`,
    '─'.repeat(Math.min(80, cols)),
  ].join('\n');
  const body = turns.map(t => {
    const label = t.kind === 'text' ? t.role : t.kind;
    const tagger = supportsColor ? COLOR[t.role] : (x: string) => x;
    return tagger(`[${label}] `) + wrap(t.text, 4, Math.max(20, cols - 4));
  });
  return [header, ...body].join('\n');
}
