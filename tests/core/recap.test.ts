import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateRecap,
  getRecap,
  readCachedRecap,
  writeRecap,
  recapPath,
  RecapError,
  type RecapDeps,
  type RecapRun,
} from '../../src/core/recap.js';

const target = { id: 'sess-1', jsonlPath: '/x.jsonl' };

let cacheDir: string;
beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'acm-recap-'));
  return () => rmSync(cacheDir, { recursive: true, force: true });
});

function deps(over: Partial<RecapDeps> = {}): RecapDeps {
  return {
    recapsDir: cacheDir,
    buildExcerpt: async () => '[user] do the thing\n[assistant] done',
    run: () => ({ stdout: '- worked on the thing\n- it is done\n', status: 0 }) as RecapRun,
    now: () => new Date('2026-06-09T10:00:00.000Z'),
    ...over,
  };
}

describe('generateRecap', () => {
  it('feeds an excerpt to the agent and returns trimmed output, defaulting to the haiku model', async () => {
    let seenArgs: string[] = [];
    let seenInput = '';
    const d = deps({
      run: (args, input) => { seenArgs = args; seenInput = input; return { stdout: '  - a recap\n', status: 0 }; },
    });
    const text = await generateRecap(target, d);
    expect(text).toBe('- a recap');
    expect(seenArgs).toEqual(['-p', '--model', 'haiku']);
    expect(seenInput).toContain('do the thing'); // the excerpt is in the prompt
  });

  it('honours an explicit model override', async () => {
    let seenArgs: string[] = [];
    await generateRecap(target, deps({ model: 'claude-haiku-4-5', run: (a) => { seenArgs = a; return { stdout: 'x', status: 0 }; } }));
    expect(seenArgs).toContain('claude-haiku-4-5');
  });

  it('throws on an empty transcript', async () => {
    await expect(generateRecap(target, deps({ buildExcerpt: async () => '   ' }))).rejects.toBeInstanceOf(RecapError);
  });

  it('throws when the agent produces no output', async () => {
    await expect(generateRecap(target, deps({ run: () => ({ stdout: '', status: 0 }) }))).rejects.toBeInstanceOf(RecapError);
  });

  it('throws a clear error when the binary is missing', async () => {
    const enoent = Object.assign(new Error('nope'), { code: 'ENOENT' });
    await expect(
      generateRecap(target, deps({ run: () => ({ stdout: '', status: null, error: enoent }) })),
    ).rejects.toMatchObject({ code: 127 });
  });
});

describe('cache round-trip', () => {
  it('writeRecap then readCachedRecap preserves text + generatedAt', () => {
    writeRecap('sess-1', '- one\n- two', deps());
    const c = readCachedRecap('sess-1', deps());
    expect(c?.text).toBe('- one\n- two');
    expect(c?.generatedAt.toISOString()).toBe('2026-06-09T10:00:00.000Z');
  });

  it('readCachedRecap returns null when absent', () => {
    expect(readCachedRecap('missing', deps())).toBeNull();
  });

  it('recapPath lives under the cache dir', () => {
    expect(recapPath('abc', deps())).toBe(join(cacheDir, 'abc.md'));
  });
});

describe('getRecap', () => {
  it('uses the cache when present and does NOT spawn the agent', async () => {
    writeRecap('sess-1', '- cached', deps());
    let ran = false;
    const r = await getRecap(target, {}, deps({ run: () => { ran = true; return { stdout: 'fresh', status: 0 }; } }));
    expect(r.fromCache).toBe(true);
    expect(r.text).toBe('- cached');
    expect(ran).toBe(false);
  });

  it('generates + caches on a miss', async () => {
    const r = await getRecap(target, {}, deps({ run: () => ({ stdout: '- generated', status: 0 }) }));
    expect(r.fromCache).toBe(false);
    expect(r.text).toBe('- generated');
    expect(readCachedRecap('sess-1', deps())?.text).toBe('- generated'); // persisted
  });

  it('refresh forces regeneration even with a cache', async () => {
    writeRecap('sess-1', '- old', deps());
    const r = await getRecap(target, { refresh: true }, deps({ run: () => ({ stdout: '- new', status: 0 }) }));
    expect(r.fromCache).toBe(false);
    expect(r.text).toBe('- new');
  });
});
