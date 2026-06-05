import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { SessionRecord } from './types.js';

export interface SearchMatch {
  session: SessionRecord;
  excerpt: string;
  matchedLine: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
  maxExcerptBefore?: number;
  maxExcerptAfter?: number;
}

function extractText(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  if (obj.type === 'user' || obj.type === 'assistant') {
    const msg = obj.message as { content?: unknown } | undefined;
    const c = msg?.content;
    if (typeof c === 'string') parts.push(c);
    else if (Array.isArray(c)) {
      for (const b of c) {
        if (b && typeof b === 'object') {
          const block = b as { type?: string; text?: unknown; thinking?: unknown; content?: unknown };
          if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
          else if (block.type === 'thinking' && typeof block.thinking === 'string') parts.push(block.thinking);
          else if (block.type === 'tool_result' && typeof block.content === 'string') parts.push(block.content);
        }
      }
    }
  }
  if (obj.type === 'custom-title' && typeof obj.customTitle === 'string') parts.push(obj.customTitle);
  if (obj.type === 'ai-title' && typeof obj.aiTitle === 'string') parts.push(obj.aiTitle);
  if (obj.type === 'summary' && typeof obj.summary === 'string') parts.push(obj.summary);
  return parts.join(' ');
}

function buildExcerpt(text: string, lowerText: string, firstTerm: string, before: number, after: number): string {
  const idx = lowerText.indexOf(firstTerm);
  if (idx < 0) return text.slice(0, before + after);
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + firstTerm.length + after);
  const head = start > 0 ? '…' : '';
  const tail = end < text.length ? '…' : '';
  return (head + text.slice(start, end) + tail).replace(/\s+/g, ' ').trim();
}

export async function* searchSessions(
  records: SessionRecord[],
  query: string,
  opts: SearchOptions = {},
): AsyncGenerator<SearchMatch> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return;
  const before = opts.maxExcerptBefore ?? 40;
  const after = opts.maxExcerptAfter ?? 80;
  for (const session of records) {
    if (opts.signal?.aborted) return;
    let found: SearchMatch | null = null;
    let lineNo = 0;
    const stream = createReadStream(session.jsonlPath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        lineNo++;
        if (opts.signal?.aborted) break;
        if (!line) continue;
        let obj: Record<string, unknown>;
        try { obj = JSON.parse(line); } catch { continue; }
        const text = extractText(obj);
        if (!text) continue;
        const lower = text.toLowerCase();
        if (terms.every(t => lower.includes(t))) {
          found = {
            session,
            matchedLine: lineNo,
            excerpt: buildExcerpt(text, lower, terms[0], before, after),
          };
          break;
        }
      }
    } finally {
      stream.destroy();
    }
    if (found && !opts.signal?.aborted) yield found;
  }
}
