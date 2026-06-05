import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', '..', 'src', 'cli', 'index.ts');
let home: string;
let cwdDir: string;

function runCli(args: string[]) {
  return spawnSync('npx', ['tsx', entry, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CCSM_HOME: home, FORCE_COLOR: '0' },
  });
}

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'ccsm-cli-'));
  cwdDir = mkdtempSync(join(tmpdir(), 'ccsm-cwd-'));
  const encoded = cwdDir.replaceAll('/', '-');
  const projDir = join(home, 'projects', encoded);
  mkdirSync(projDir, { recursive: true });
  writeFileSync(
    join(projDir, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jsonl'),
    `{"type":"user","timestamp":1700000000000,"message":{"role":"user","content":"hi from fixture"}}\n`,
  );
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(cwdDir, { recursive: true, force: true });
});

describe('ccsm CLI', () => {
  it('ls --json returns an array with the fixture session', () => {
    const r = runCli(['ls', '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as Array<{ id: string; name: string }>;
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('hi from fixture');
  });

  it('peek prints transcript turns', () => {
    const r = runCli(['peek', 'aaaaaaaa']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('hi from fixture');
  });

  it('exits 1 on missing id', () => {
    const r = runCli(['peek', 'zzzzzzzz']);
    expect(r.status).toBe(1);
  });
});
