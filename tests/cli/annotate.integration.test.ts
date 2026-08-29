import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', '..', 'src', 'cli', 'index.ts');
const ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
let xdg: string;

function runCli(args: string[]) {
  return spawnSync('npx', ['tsx', entry, ...args], {
    encoding: 'utf8',
    // XDG_CONFIG_HOME redirects the annotation store; CCSM_HOME keeps the session scan empty+fast.
    env: { ...process.env, XDG_CONFIG_HOME: xdg, CCSM_HOME: join(xdg, 'no-sessions'), FORCE_COLOR: '0' },
  });
}

beforeAll(() => { xdg = mkdtempSync(join(tmpdir(), 'acm-annotate-cli-')); });
afterAll(() => { rmSync(xdg, { recursive: true, force: true }); });

describe('annotation commands', () => {
  it('names, notes, flags and reminds a session by id, and lists it back', () => {
    expect(runCli(['name', '-s', ID, 'billing', 'spike']).status).toBe(0);
    expect(runCli(['note', '-s', ID, 'waiting', 'on', 'review']).status).toBe(0);
    expect(runCli(['flag', '-s', ID, 'todo', 'Follow Up']).status).toBe(0);
    expect(runCli(['remind', '-s', ID, '2h']).status).toBe(0);

    const out = runCli(['annotations', '--json']);
    expect(out.status).toBe(0);
    const [a] = JSON.parse(out.stdout);
    expect(a.name).toBe('billing spike');
    expect(a.note).toBe('waiting on review');
    expect(a.flags).toEqual(['follow-up', 'todo']);
    expect(Date.parse(a.remindAt)).toBeGreaterThan(Date.now());
  });

  it('renames repeatedly, last one wins', () => {
    for (const n of ['one', 'two', 'three']) runCli(['name', '-s', ID, n]);
    const [a] = JSON.parse(runCli(['annotations', '--json']).stdout);
    expect(a.name).toBe('three');
  });

  it('toggles done both ways', () => {
    expect(runCli(['done', '-s', ID, '--json']).stdout).toContain('"done":true');
    expect(runCli(['done', '-s', ID, '--undo', '--json']).stdout).toContain('"done":false');
  });

  it('rejects a time it cannot parse', () => {
    const r = runCli(['remind', '-s', ID, 'whenever']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("can't read a time");
  });

  it('refuses to act with no id when not inside a Claude session', () => {
    const r = runCli(['flag', 'orphan']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('pass -s');
  });
});
