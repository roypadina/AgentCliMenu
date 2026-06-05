import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { projectsDir } from './paths.js';
import { decodeCwd } from './decode.js';
import { scanJsonl } from './jsonlScan.js';
import { liveSessionById } from './liveState.js';
import { readGitBranch } from './git.js';
import type { ListOptions, SessionRecord, SessionStatus } from './types.js';

export async function listSessions(opts: ListOptions = {}): Promise<SessionRecord[]> {
  const root = projectsDir();
  if (!existsSync(root)) return [];
  const out: SessionRecord[] = [];
  let projectDirs: string[];
  try {
    projectDirs = readdirSync(root);
  } catch {
    return [];
  }
  for (const dir of projectDirs) {
    if (!dir.startsWith('-')) continue;
    const decoded = decodeCwd(dir);
    if (opts.cwd && decoded.cwd !== opts.cwd) continue;
    const projectPath = join(root, dir);
    let entries: string[];
    try {
      entries = readdirSync(projectPath);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (!file.endsWith('.jsonl')) continue;
      const id = file.replace(/\.jsonl$/, '');
      const jsonlPath = join(projectPath, file);
      const st = statSync(jsonlPath);
      const scan = await scanJsonl(jsonlPath);
      const live = liveSessionById(id);
      const status: SessionStatus = live ? live.status : 'inactive';
      const rec: SessionRecord = {
        id,
        name: scan.customTitle ?? scan.aiTitle ?? scan.firstPrompt ?? '(no prompt yet)',
        cwd: live?.cwd ?? decoded.cwd,
        cwdDecodeConfident: live ? true : decoded.confident,
        jsonlPath,
        sizeBytes: st.size,
        startedAt: live ? new Date(live.startedAt) : (scan.firstTimestamp ?? st.ctime),
        lastUpdatedAt: live ? new Date(live.updatedAt) : st.mtime,
        active: !!live,
        status,
        pid: live?.pid,
        version: live?.version,
        gitBranch: readGitBranch(live?.cwd ?? decoded.cwd) ?? undefined,
      };
      if (opts.activeOnly && !rec.active) continue;
      out.push(rec);
    }
  }
  const sortBy = opts.sortBy ?? 'updated';
  out.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    const aKey = sortBy === 'started' ? a.startedAt : a.lastUpdatedAt;
    const bKey = sortBy === 'started' ? b.startedAt : b.lastUpdatedAt;
    return bKey.getTime() - aKey.getTime();
  });
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function getSession(prefix: string): Promise<SessionRecord[]> {
  const all = await listSessions();
  return all.filter(s => s.id.startsWith(prefix));
}
