import { existsSync } from 'node:fs';

export interface DecodedCwd {
  cwd: string;
  confident: boolean;
}

export function decodeCwd(encoded: string): DecodedCwd {
  const stripped = encoded.startsWith('-') ? encoded.slice(1) : encoded;
  const parts = stripped.split('-');
  const hit = search(parts, 0, '');
  if (hit) return { cwd: hit, confident: true };
  return { cwd: '/' + parts.join('/'), confident: false };
}

/**
 * Recursive search: at each position i we consume one or more parts to form
 * the next path segment (joining with '-'), then recurse on the remainder.
 * Pruning: we only proceed if the accumulated path so far exists on disk.
 */
function search(parts: string[], i: number, acc: string): string | null {
  if (i === parts.length) {
    return existsSync(acc) ? acc : null;
  }
  // Prune: if acc is non-empty and doesn't exist, this branch is dead.
  if (acc && !existsSync(acc)) return null;

  // Try consuming parts[i], parts[i..i+1], parts[i..i+2], ... as a single segment.
  // The candidate segment grows by appending '-' + next part each iteration.
  let segment = parts[i];
  for (let j = i; j < parts.length; j++) {
    if (j > i) segment += '-' + parts[j];
    const candidate = acc + '/' + segment;
    const result = search(parts, j + 1, candidate);
    if (result) return result;
  }
  return null;
}
