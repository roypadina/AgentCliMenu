import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listProfiles, resolveProfile, profileConfigPath, isPrimaryHome } from '../../src/core/profiles.js';

let home: string;
let origHome: string | undefined;
let origPin: string | undefined;

const account = (email: string) => JSON.stringify({ oauthAccount: { emailAddress: email } });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'agentctl-profiles-'));
  origHome = process.env.HOME;
  origPin = process.env.AGENTCTL_HOME;
  process.env.HOME = home;
  delete process.env.AGENTCTL_HOME;
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
  if (origPin === undefined) delete process.env.AGENTCTL_HOME; else process.env.AGENTCTL_HOME = origPin;
});

describe('profileConfigPath', () => {
  it('puts the default profile config BESIDE ~/.claude, not inside it', () => {
    // getting this wrong points Claude at a logged-out stub and shows a login prompt
    expect(profileConfigPath(join(home, '.claude'))).toBe(join(home, '.claude.json'));
    expect(isPrimaryHome(join(home, '.claude'))).toBe(true);
  });

  it('puts a side profile config inside its own home', () => {
    expect(profileConfigPath(join(home, '.claude3'))).toBe(join(home, '.claude3', '.claude.json'));
  });
});

describe('a machine with one account (the normal case)', () => {
  beforeEach(() => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude.json'), account('solo@example.com'));
  });

  it('reports exactly one profile, and it is the default', () => {
    const all = listProfiles();
    expect(all).toHaveLength(1);
    expect(all[0].account).toBe('solo@example.com');
    expect(all[0].isPrimary).toBe(true);
  });
});

describe('a machine with several accounts', () => {
  beforeEach(() => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude.json'), account('primary@example.com'));
    mkdirSync(join(home, '.claude3'), { recursive: true });
    writeFileSync(join(home, '.claude3', '.claude.json'), account('side@example.com'));
    // a profile dir that was never logged in must not be offered
    mkdirSync(join(home, '.claude-empty'), { recursive: true });
  });

  it('lists only logged-in profiles, primary first', () => {
    const all = listProfiles();
    expect(all.map(p => p.account)).toEqual(['primary@example.com', 'side@example.com']);
  });

  it('resolves by email, by prefix, by directory name and by path', () => {
    expect(resolveProfile('side@example.com')?.account).toBe('side@example.com');
    expect(resolveProfile('side')?.account).toBe('side@example.com');
    expect(resolveProfile('claude3')?.account).toBe('side@example.com');
    expect(resolveProfile('.claude3')?.account).toBe('side@example.com');
    expect(resolveProfile(join(home, '.claude3'))?.account).toBe('side@example.com');
    expect(resolveProfile('nope')).toBeNull();
  });
});
