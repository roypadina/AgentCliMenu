import { readdirSync } from 'node:fs';

export interface DecodedCwd {
  cwd: string;
  confident: boolean;
}

/**
 * Claude Code flattens the cwd into a directory name by replacing the separators AND every `.`
 * (and other punctuation) with `-`, so the encoding is many-to-one: `-a-b` could be `/a/b`,
 * `/a.b`, `/a-b`… Rather than guess, walk the real filesystem and keep only the children that
 * could have produced the encoded name. Matching against what is actually on disk is both exact
 * and cheap; the old regroup-and-test search was exponential in the number of dashes.
 */
export function decodeCwd(encoded: string): DecodedCwd {
  const stripped = encoded.startsWith('-') ? encoded.slice(1) : encoded;
  const hit = search(stripped, '');
  if (hit) return { cwd: hit, confident: true };
  return { cwd: '/' + stripped.split('-').join('/'), confident: false };
}

function children(dir: string): string[] {
  // Deliberately uncached: a long-running TUI must see a directory created since it started,
  // and the walk is a handful of readdir calls per session anyway.
  try { return readdirSync(dir || '/'); } catch { return []; }
}

/** True when `rest` opens with an encoding of `name` — `-` matches any non-alphanumeric char. */
function encodes(rest: string, name: string): boolean {
  if (rest.length < name.length) return false;
  for (let i = 0; i < name.length; i++) {
    const r = rest[i], n = name[i];
    if (r === n) continue;
    if (r === '-' && !/[a-zA-Z0-9]/.test(n)) continue;
    return false;
  }
  return true;
}

function search(rest: string, acc: string): string | null {
  if (!rest) return acc || null;
  for (const name of children(acc)) {
    if (!encodes(rest, name)) continue;
    const tail = rest.slice(name.length);
    if (!tail) return acc + '/' + name;
    if (tail[0] !== '-') continue;      // the next char must be the separator
    const hit = search(tail.slice(1), acc + '/' + name);
    if (hit) return hit;
  }
  return null;
}
