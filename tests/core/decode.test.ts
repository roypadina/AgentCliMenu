import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeCwd } from '../../src/core/decode.js';

describe('decodeCwd', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'agentctl-decode-'));
    mkdirSync(join(root, 'Users/roy/Code/Work/My-App-Repo/sub'), { recursive: true });
    mkdirSync(join(root, 'Users/roy/Code/plain'), { recursive: true });
  });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('decodes pure-separator paths', () => {
    const enc = root.replaceAll('/', '-') + '-Users-roy-Code-plain';
    const r = decodeCwd(enc);
    expect(r.cwd).toBe(join(root, 'Users/roy/Code/plain'));
    expect(r.confident).toBe(true);
  });

  it('decodes paths with real dashes in leaf', () => {
    const enc = root.replaceAll('/', '-') + '-Users-roy-Code-Work-My-App-Repo';
    const r = decodeCwd(enc);
    expect(r.cwd).toBe(join(root, 'Users/roy/Code/Work/My-App-Repo'));
    expect(r.confident).toBe(true);
  });

  it('decodes paths with real dashes mid-tree', () => {
    const enc = root.replaceAll('/', '-') + '-Users-roy-Code-Work-My-App-Repo-sub';
    const r = decodeCwd(enc);
    expect(r.cwd).toBe(join(root, 'Users/roy/Code/Work/My-App-Repo/sub'));
    expect(r.confident).toBe(true);
  });

  it('returns aggressive non-confident result when nothing matches', () => {
    const r = decodeCwd('-nonexistent-path-xyz');
    expect(r.cwd).toBe('/nonexistent/path/xyz');
    expect(r.confident).toBe(false);
  });
});
