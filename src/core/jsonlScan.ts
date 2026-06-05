import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface ScanResult {
  firstPrompt: string | null;
  customTitle: string | null;
  aiTitle: string | null;
  firstTimestamp: Date | null;
  corruptLines: number;
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

function stripTags(text: string): string {
  let t = text;
  for (const tag of KEEP_INNER_TAGS) {
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g'), '$1');
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)$`, 'g'), '$1');
  }
  for (const tag of STRIP_TAGS) {
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'g'), '');
    t = t.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*$`, 'g'), '');
  }
  return t;
}

function deriveName(raw: string): string {
  let t = stripTags(raw);
  t = t.replace(/^\/[\w-]+(?::[\w-]+)?\s+/, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length > 80) t = t.slice(0, 79) + '…';
  return t;
}

function extractUserText(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (o.type !== 'user') return null;
  const msg = o.message as { content?: unknown } | undefined;
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    for (const block of c) {
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
        const text = (block as { text?: unknown }).text;
        if (typeof text === 'string') return text;
      }
    }
  }
  return null;
}

function trimTitle(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > 120 ? t.slice(0, 119) + '…' : t;
}

export async function scanJsonl(path: string): Promise<ScanResult> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let firstPrompt: string | null = null;
  let customTitle: string | null = null;
  let aiTitle: string | null = null;
  let firstTimestamp: Date | null = null;
  let corruptLines = 0;
  try {
    for await (const line of rl) {
      if (!line) continue;
      let obj: unknown;
      try { obj = JSON.parse(line); } catch { corruptLines++; continue; }
      const o = obj as Record<string, unknown>;
      if (o.type === 'custom-title') {
        const t = trimTitle(o.customTitle);
        if (t) customTitle = t;
        continue;
      }
      if (o.type === 'ai-title') {
        const t = trimTitle(o.aiTitle);
        if (t) aiTitle = t;
        continue;
      }
      if (firstPrompt === null) {
        const raw = extractUserText(obj);
        if (raw !== null) {
          const cleaned = deriveName(raw);
          if (cleaned) firstPrompt = cleaned;
        }
      }
      if (firstTimestamp === null) {
        const ts = o.timestamp;
        if (typeof ts === 'number' && Number.isFinite(ts)) {
          firstTimestamp = new Date(ts);
        }
      }
    }
  } finally {
    stream.destroy();
  }
  return { firstPrompt, customTitle, aiTitle, firstTimestamp, corruptLines };
}
