import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sessionsDirs } from './paths.js';
import type { LiveSession } from './types.js';

export function readLiveSessions(): LiveSession[] {
  const out: LiveSession[] = [];
  for (const dir of sessionsDirs()) {
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = readFileSync(join(dir, f), 'utf8');
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

/** A record is live only if its PID is alive AND still a claude process. */
function isLiveClaude(s: LiveSession): boolean {
  if (!isPidAlive(s.pid)) return false;
  const cmd = pidCommand(s.pid);
  return cmd === null || /claude/i.test(cmd);
}

/** All live sessions keyed by id — one scan for callers that resolve many ids. */
export function liveSessionMap(): Map<string, LiveSession> {
  const out = new Map<string, LiveSession>();
  for (const s of readLiveSessions()) {
    if (out.has(s.sessionId)) continue;
    if (!isLiveClaude(s)) continue;
    out.set(s.sessionId, s);
  }
  return out;
}

export function liveSessionById(id: string): LiveSession | null {
  for (const s of readLiveSessions()) {
    if (s.sessionId === id && isLiveClaude(s)) return s;
  }
  return null;
}

function parentPid(pid: number): number | null {
  try {
    const out = execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const n = Number(out.trim());
    return Number.isFinite(n) && n > 1 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The session id of the Claude process we are running *inside*, or null when standalone.
 * Walks the parent-pid chain (a hook/shell can be several levels below claude) and matches
 * against the live session files. Lets `acm note --current …` work with no arguments.
 */
export function currentSessionId(startPid = process.pid): string | null {
  const byPid = new Map(readLiveSessions().map(s => [s.pid, s.sessionId]));
  if (byPid.size === 0) return null;
  let pid: number | null = startPid;
  for (let i = 0; i < 12 && pid !== null; i++) {
    const hit = byPid.get(pid);
    if (hit) return hit;
    pid = parentPid(pid);
  }
  return null;
}
