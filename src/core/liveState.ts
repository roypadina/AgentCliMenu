import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sessionsDir } from './paths.js';
import type { LiveSession } from './types.js';

export function readLiveSessions(): LiveSession[] {
  let files: string[];
  try {
    files = readdirSync(sessionsDir());
  } catch {
    return [];
  }
  const out: LiveSession[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = readFileSync(join(sessionsDir(), f), 'utf8');
      const data = JSON.parse(raw) as Partial<LiveSession>;
      if (
        typeof data.pid !== 'number' ||
        typeof data.sessionId !== 'string' ||
        typeof data.cwd !== 'string' ||
        typeof data.startedAt !== 'number' ||
        typeof data.updatedAt !== 'number' ||
        (data.status !== 'busy' && data.status !== 'idle')
      ) continue;
      out.push(data as LiveSession);
    } catch {
      // skip corrupt
    }
  }
  return out;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but we lack permission to signal it.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function pidCommand(pid: number): string | null {
  try {
    const out = execFileSync('ps', ['-o', 'comm=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function liveSessionById(id: string): LiveSession | null {
  const all = readLiveSessions();
  for (const s of all) {
    if (s.sessionId !== id) continue;
    if (!isPidAlive(s.pid)) continue;
    const cmd = pidCommand(s.pid);
    if (cmd !== null && !/claude/i.test(cmd)) continue;
    return s;
  }
  return null;
}
