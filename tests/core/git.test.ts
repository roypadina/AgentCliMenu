import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGitBranch } from '../../src/core/git.js';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ccsm-git-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('readGitBranch', () => {
  it('returns null for non-git directory', () => {
    expect(readGitBranch(root)).toBeNull();
  });

  it('returns null when cwd is undefined', () => {
    expect(readGitBranch(undefined)).toBeNull();
  });

  it('reads branch from .git/HEAD ref', () => {
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/feature/foo-bar\n');
    expect(readGitBranch(root)).toBe('feature/foo-bar');
  });

  it('returns short SHA for detached HEAD', () => {
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, '.git', 'HEAD'), 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n');
    expect(readGitBranch(root)).toBe('deadbee');
  });

  it('follows .git file (submodule/worktree) to gitdir', () => {
    const realGit = join(root, 'modules', 'sub');
    mkdirSync(realGit, { recursive: true });
    writeFileSync(join(realGit, 'HEAD'), 'ref: refs/heads/main\n');
    const work = join(root, 'work');
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, '.git'), `gitdir: ${realGit}\n`);
    expect(readGitBranch(work)).toBe('main');
  });
});
