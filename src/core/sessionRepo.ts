import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectsDirs } from './paths.js';
import { decodeCwd } from './decode.js';
import { scanJsonl } from './jsonlScan.js';
import { liveSessionMap } from './liveState.js';
import { readGitBranch } from './git.js';
import { readAllAnnotations } from './annotations.js';
import type { Stats } from 'node:fs';
import type { Annotation, ListOptions, LiveSession, SessionRecord } from './types.js';

export async function listSessions(opts: ListOptions = {}): Promise<SessionRecord[]> {
  const out: SessionRecord[] = [];
  const live = liveSessionMap();
  const annotations = readAllAnnotations();
  for (const root of projectsDirs()) {
    let projectDirs: string[];
    try {
      projectDirs = readdirSync(root);
    } catch {
      continue;
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
        const rec = buildRecord(id, jsonlPath, st, scan, decoded, live.get(id) ?? null, annotations.get(id), dirname(root));
        if (opts.activeOnly && !rec.active) continue;
        out.push(rec);
      }
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

function buildRecord(
  id: string,
  jsonlPath: string,
  st: Stats,
  scan: Awaited<ReturnType<typeof scanJsonl>>,
  decoded: ReturnType<typeof decodeCwd>,
  live: LiveSession | null,
  annotation: Annotation | undefined,
  configDir: string,
): SessionRecord {
  const transcriptName = scan.customTitle ?? scan.aiTitle ?? scan.firstPrompt ?? '(no prompt yet)';
  return {
    id,
    name: annotation?.name ?? transcriptName,
    transcriptName,
    cwd: live?.cwd ?? decoded.cwd,
    cwdDecodeConfident: live ? true : decoded.confident,
    jsonlPath,
    sizeBytes: st.size,
    startedAt: live ? new Date(live.startedAt) : (scan.firstTimestamp ?? st.ctime),
    lastUpdatedAt: live ? new Date(live.updatedAt) : st.mtime,
    active: !!live,
    status: live ? live.status : 'inactive',
    pid: live?.pid,
    version: live?.version,
    gitBranch: readGitBranch(live?.cwd ?? decoded.cwd) ?? undefined,
    // A live session's pid file pins the real profile; otherwise fall back to the scan root.
    configDir: live?.profile ?? configDir,
    annotation,
  };
}

export async function getSession(prefix: string): Promise<SessionRecord[]> {
  const all = await listSessions();
  return all.filter(s => s.id.startsWith(prefix));
}
