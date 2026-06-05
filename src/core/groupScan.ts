import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readGitBranch } from './git.js';
import type { GroupConfig } from './config/types.js';

export interface ProjectDir {
  name: string;
  path: string;
  group: string;
  groupColor: string;
  /** sort key, ms. From z frecency time (×1000) when known, else dir mtime. */
  timeMs: number;
  scoreSource: 'z' | 'mtime';
  gitBranch?: string;
}

export interface GroupScanOptions {
  withGit?: boolean;
  /** defaults to $_Z_DATA or ~/.z */
  zDataPath?: string;
}

/** Parse a `z`/`autojump`-style db: each line `path|rank|time`. time is unix SECONDS. */
export function parseZDb(zDataPath: string): Map<string, number> {
  const out = new Map<string, number>();
  let text: string;
  try {
    text = readFileSync(zDataPath, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('|');
    if (f.length < 3) continue;
    const t = Number(f[2]);
    if (!Number.isFinite(t)) continue;
    out.set(f[0], t * 1000);
  }
  return out;
}

function isDirPath(p: string): boolean {
  try {
    return statSync(p).isDirectory(); // follows symlinks; dangling → throw → false
  } catch {
    return false;
  }
}

/** Scan one group's path one level deep, newest-first (z time, else mtime). */
export function sortGroup(group: GroupConfig, zMap: Map<string, number>, withGit = false): ProjectDir[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(group.path, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs: ProjectDir[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const path = join(group.path, e.name);
    if (!e.isDirectory() && !(e.isSymbolicLink() && isDirPath(path))) continue;
    const zTime = zMap.get(path);
    let timeMs: number;
    let scoreSource: 'z' | 'mtime';
    if (zTime !== undefined) {
      timeMs = zTime;
      scoreSource = 'z';
    } else {
      try {
        timeMs = statSync(path).mtimeMs;
      } catch {
        continue;
      }
      scoreSource = 'mtime';
    }
    dirs.push({
      name: e.name,
      path,
      group: group.name,
      groupColor: group.color,
      timeMs,
      scoreSource,
      gitBranch: withGit ? (readGitBranch(path) ?? undefined) : undefined,
    });
  }
  dirs.sort((a, b) => b.timeMs - a.timeMs);
  return dirs;
}

/** Per-group project lists, group order preserved. */
export async function listProjects(
  groups: GroupConfig[],
  opts: GroupScanOptions = {},
): Promise<ProjectDir[][]> {
  const zPath = opts.zDataPath ?? process.env._Z_DATA ?? join(homedir(), '.z');
  const zMap = parseZDb(zPath);
  return groups.map(g => sortGroup(g, zMap, opts.withGit ?? false));
}
