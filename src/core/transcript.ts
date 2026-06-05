import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { TranscriptTurn } from './types.js';

export interface TranscriptOptions {
  full?: boolean;
  head?: number;
  tail?: number;
}

const STRIP_TAGS = [
  'command-message',
  'command-name',
  'system-reminder',
  'local-command-caveat',
  'local-command-stdout',
  'local-command-stderr',
];

const KEEP_INNER_TAGS = ['command-args'];

function clean(text: string): string {
  let t = text;
  for (const tag of KEEP_INNER_TAGS) {
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g'), '$1');
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)$`, 'g'), '$1');
  }
  for (const tag of STRIP_TAGS) {
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'g'), '');
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*$`, 'g'), '');
  }
  return t.trim();
}

function trunc(t: string, n = 500): string {
  return t.length <= n ? t : t.slice(0, n) + ` […+${t.length - n} more]`;
}

interface ContentBlock {
  type?: string;
  text?: unknown;
  thinking?: unknown;
  name?: unknown;
  input?: unknown;
  content?: unknown;
  tool_use_id?: unknown;
}

function asBlocks(value: unknown): ContentBlock[] | null {
  return Array.isArray(value) ? (value as ContentBlock[]) : null;
}

export async function readTranscript(
  jsonlPath: string,
  opts: TranscriptOptions = {},
): Promise<TranscriptTurn[]> {
  const stream = createReadStream(jsonlPath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const turns: TranscriptTurn[] = [];
  for await (const line of rl) {
    if (!line) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch { continue; }

    if (obj.type === 'summary' && typeof obj.summary === 'string') {
      turns.push({ role: 'system', kind: 'summary', text: obj.summary });
      continue;
    }

    if (obj.type === 'user') {
      const msg = obj.message as { content?: unknown } | undefined;
      const c = msg?.content;
      if (typeof c === 'string') {
        const t = clean(c);
        if (t) turns.push({ role: 'user', kind: 'text', text: t });
      } else {
        const blocks = asBlocks(c);
        if (blocks) {
          for (const b of blocks) {
            if (b.type === 'text' && typeof b.text === 'string') {
              const t = clean(b.text);
              if (t) turns.push({ role: 'user', kind: 'text', text: t });
            } else if (b.type === 'tool_result' && opts.full) {
              const content = typeof b.content === 'string'
                ? b.content
                : JSON.stringify(b.content ?? '');
              turns.push({ role: 'tool', kind: 'tool-result', text: trunc(content) });
            }
          }
        }
      }
      continue;
    }

    if (obj.type === 'assistant') {
      const msg = obj.message as { content?: unknown } | undefined;
      const blocks = asBlocks(msg?.content);
      if (blocks) {
        for (const b of blocks) {
          if (b.type === 'text' && typeof b.text === 'string') {
            turns.push({ role: 'assistant', kind: 'text', text: b.text });
          } else if (b.type === 'thinking' && opts.full) {
            const text = typeof b.thinking === 'string'
              ? b.thinking
              : (typeof b.text === 'string' ? b.text : '');
            turns.push({ role: 'assistant', kind: 'thinking', text: trunc(text) });
          } else if (b.type === 'tool_use' && opts.full) {
            const args = JSON.stringify(b.input ?? {});
            turns.push({
              role: 'assistant',
              kind: 'tool-use',
              text: `${String(b.name ?? '?')}(${trunc(args, 200)})`,
            });
          }
        }
      }
      continue;
    }

    if (opts.full && obj.attachment && typeof obj.attachment === 'object') {
      const a = obj.attachment as { type?: unknown; content?: unknown };
      const text = `${String(a.type ?? '')}: ${typeof a.content === 'string' ? a.content : ''}`;
      turns.push({ role: 'system', kind: 'attachment', text: trunc(text) });
    }
  }

  if (opts.head != null && opts.tail != null && turns.length > opts.head + opts.tail) {
    const skipped = turns.length - opts.head - opts.tail;
    return [
      ...turns.slice(0, opts.head),
      { role: 'system', kind: 'summary', text: `… (${skipped} turns skipped) …` },
      ...turns.slice(-opts.tail),
    ];
  }
  return turns;
}
