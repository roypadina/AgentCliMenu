import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSessions, getSession } from '../../src/core/sessionRepo.js';

let home: string;
let cwd: string;
let origHome: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ccsm-repo-'));
  cwd = mkdtempSync(join(tmpdir(), 'ccsm-cwd-'));
  origHome = process.env.CCSM_HOME;
  process.env.CCSM_HOME = home;
  const encoded = cwd.replaceAll('/', '-');
  const projDir = join(home, 'projects', encoded);
  mkdirSync(projDir, { recursive: true });
  const id1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const id2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  writeFileSync(join(projDir, `${id1}.jsonl`),
    `{"type":"user","timestamp":1700000000000,"message":{"role":"user","content":"first session"}}\n`);
  writeFileSync(join(projDir, `${id2}.jsonl`),
    `{"type":"user","timestamp":1700000010000,"message":{"role":"user","content":"second session"}}\n`);
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
  if (origHome === undefined) delete process.env.CCSM_HOME;
  else process.env.CCSM_HOME = origHome;
});

describe('listSessions', () => {
  it('returns one record per .jsonl with decoded cwd', async () => {
    const records = await listSessions();
    expect(records).toHaveLength(2);
    expect(records[0].cwd).toBe(cwd);
    expect(records[0].cwdDecodeConfident).toBe(true);
    expect(records[0].active).toBe(false);
    expect(records[0].status).toBe('inactive');
  });

  it('filters by cwd', async () => {
    const records = await listSessions({ cwd });
    expect(records).toHaveLength(2);
    const none = await listSessions({ cwd: '/no/such/place' });
    expect(none).toHaveLength(0);
  });

  it('limits and sorts by name', async () => {
    const records = await listSessions({ sortBy: 'name', limit: 1 });
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('first session');
  });

  it('returns [] when projects dir missing', async () => {
    rmSync(join(home, 'projects'), { recursive: true, force: true });
    expect(await listSessions()).toEqual([]);
  });
});

describe('getSession', () => {
  it('matches by prefix', async () => {
    const matches = await getSession('aaaa');
    expect(matches).toHaveLength(1);
    expect(matches[0].id.startsWith('aaaa')).toBe(true);
  });
});
