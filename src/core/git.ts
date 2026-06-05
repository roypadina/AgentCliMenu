import { readFileSync, statSync, existsSync } from 'node:fs';
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
