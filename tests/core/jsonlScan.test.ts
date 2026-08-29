import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJsonl } from '../../src/core/jsonlScan.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures', 'transcripts');

describe('scanJsonl', () => {
  it('returns first user prompt and first timestamp', async () => {
    const r = await scanJsonl(join(fixtures, 'simple.jsonl'));
    expect(r.firstPrompt).toBe('hello world');
    expect(r.firstTimestamp?.getTime()).toBe(1700000000000);
    expect(r.corruptLines).toBe(0);
  });

  it('skips corrupt lines and still finds first prompt', async () => {
    const r = await scanJsonl(join(fixtures, 'malformed.jsonl'));
    expect(r.firstPrompt).toBe('after corrupt');
    expect(r.corruptLines).toBe(1);
  });

  it('strips command tags to derive a clean prompt', async () => {
    const r = await scanJsonl(join(fixtures, 'with-command-tags.jsonl'));
    expect(r.firstPrompt).toBe('real prompt here');
  });

  it('returns nulls for empty file', async () => {
    const r = await scanJsonl(join(fixtures, 'does-not-exist.jsonl')).catch(() => null);
    expect(r).toBeNull();
  });

  it('captures custom-title and ai-title separately, keeping latest of each', async () => {
    const r = await scanJsonl(join(fixtures, 'with-titles.jsonl'));
    expect(r.customTitle).toBe('Snowflake plugin');
    expect(r.aiTitle).toBe('Newer auto title');
    expect(r.firstPrompt).toBe('the original prompt');
  });

  it('parses ISO-string timestamps (real Claude Code format), not just numbers', async () => {
    // Real transcripts use ISO strings; a numeric-only parse left `started` falling back to ctime.
    const r = await scanJsonl(join(fixtures, 'iso-timestamp.jsonl'));
    expect(r.firstPrompt).toBe('iso hello');
    expect(r.firstTimestamp?.toISOString()).toBe('2026-06-04T12:12:49.361Z');
  });
});

describe('repeated renames', () => {
  it('takes the last custom-title, so a session can be renamed any number of times', async () => {
    const out = await scanJsonl('tests/fixtures/transcripts/repeated-renames.jsonl');
    expect(out.customTitle).toBe('third and final name');
  });
});
