import { readFileSync, statSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join, isAbsolute, resolve } from 'node:path';

export function readGitBranch(cwd: string | undefined): string | null {
  if (!cwd) return null;
  try {
    let gitDir = join(cwd, '.git');
    const st = statSync(gitDir);
    if (st.isFile()) {
      const content = readFileSync(gitDir, 'utf8').trim();
      const m = content.match(/^gitdir:\s*(.+)$/m);
      if (!m) return null;
      const ref = m[1].trim();
      gitDir = isAbsolute(ref) ? ref : resolve(cwd, ref);
    } else if (!st.isDirectory()) {
      return null;
    }
    const headPath = join(gitDir, 'HEAD');
    if (!existsSync(headPath)) return null;
    const head = readFileSync(headPath, 'utf8').trim();
    if (head.startsWith('ref:')) {
      return head.slice(4).trim().replace(/^refs\/heads\//, '');
    }
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7);
    return null;
  } catch {
    return null;
  }
}

/** Count changed paths in `git status --porcelain` output — one line per path. */
export function parseDirtyCount(porcelain: string): number {
  return porcelain.split('\n').filter(l => l.trim() !== '').length;
}

/**
 * Uncommitted-change count for ONE directory. This is the only sanctioned `git` spawn:
 * callers must limit it to the highlighted row, never the scan path (see CLAUDE.md).
 * Returns null when the dir isn't a repo, git is missing, or the call times out.
 */
export function countDirty(cwd: string): Promise<number | null> {
  return new Promise(resolve => {
    execFile(
      'git',
      ['status', '--porcelain'],
      { cwd, timeout: 2000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : parseDirtyCount(stdout)),
    );
  });
}
