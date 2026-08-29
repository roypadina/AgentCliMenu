import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ccsmHome, projectsDir, sessionsDir, claudeHomes, projectsDirs, sessionsDirs } from '../../src/core/paths.js';

describe('paths', () => {
  const original = process.env.CCSM_HOME;
  beforeEach(() => { delete process.env.CCSM_HOME; });
  afterEach(() => { if (original === undefined) delete process.env.CCSM_HOME; else process.env.CCSM_HOME = original; });

  it('defaults ccsmHome to ~/.claude', () => {
    expect(ccsmHome()).toBe(join(homedir(), '.claude'));
  });

  it('honors CCSM_HOME override', () => {
    process.env.CCSM_HOME = '/tmp/fake-home';
    expect(ccsmHome()).toBe('/tmp/fake-home');
    expect(projectsDir()).toBe('/tmp/fake-home/projects');
    expect(sessionsDir()).toBe('/tmp/fake-home/sessions');
  });
});

describe('multi-profile discovery', () => {
  let home: string;
  let origHome: string | undefined;
  let origCcsm: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'acm-homes-'));
    origHome = process.env.HOME;
    origCcsm = process.env.CCSM_HOME;
    process.env.HOME = home;
    delete process.env.CCSM_HOME;
    // primary + a side profile that shares `projects/` by symlink but has its own `sessions/`
    mkdirSync(join(home, '.claude', 'projects'), { recursive: true });
    mkdirSync(join(home, '.claude', 'sessions'), { recursive: true });
    mkdirSync(join(home, '.claude-work2', 'sessions'), { recursive: true });
    symlinkSync(join(home, '.claude', 'projects'), join(home, '.claude-work2', 'projects'));
    mkdirSync(join(home, '.config'), { recursive: true });
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origCcsm === undefined) delete process.env.CCSM_HOME; else process.env.CCSM_HOME = origCcsm;
  });

  it('finds side profiles and keeps the primary first', () => {
    expect(claudeHomes()).toEqual([join(home, '.claude'), join(home, '.claude-work2')]);
  });

  it('collapses a symlinked projects dir but keeps both sessions dirs', () => {
    expect(projectsDirs()).toEqual([join(home, '.claude', 'projects')]);
    expect(sessionsDirs()).toEqual([
      join(home, '.claude', 'sessions'),
      join(home, '.claude-work2', 'sessions'),
    ]);
  });

  it('CCSM_HOME pins the scan to one profile', () => {
    process.env.CCSM_HOME = join(home, '.claude');
    expect(claudeHomes()).toEqual([join(home, '.claude')]);
    expect(sessionsDirs()).toEqual([join(home, '.claude', 'sessions')]);
  });
});
