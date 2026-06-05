import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTranscript } from '../../src/core/transcript.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures', 'transcripts');

describe('readTranscript', () => {
  it('default mode hides tool noise and strips system-reminders', async () => {
    const turns = await readTranscript(join(fixtures, 'with-tools.jsonl'));
    const kinds = turns.map(t => `${t.role}/${t.kind}`);
    expect(kinds).toEqual([
      'user/text',
      'assistant/text',
      'assistant/text',
      'system/summary',
    ]);
    expect(turns[0].text).toBe('real question');
    expect(turns[1].text).toBe('reading file');
    expect(turns[2].text).toBe('answer here');
    expect(turns[3].text).toBe('discussed hosts file');
  });

  it('--full includes tool_use, tool_result, thinking, attachments', async () => {
    const turns = await readTranscript(join(fixtures, 'with-tools.jsonl'), { full: true });
    const kinds = turns.map(t => t.kind);
    expect(kinds).toContain('tool-use');
    expect(kinds).toContain('tool-result');
    expect(kinds).toContain('thinking');
  });

  it('--head/--tail collapses middle with a marker', async () => {
    const turns = await readTranscript(join(fixtures, 'with-tools.jsonl'), { head: 1, tail: 1 });
    expect(turns).toHaveLength(3);
    expect(turns[1].kind).toBe('summary');
    expect(turns[1].text).toMatch(/turns skipped/);
  });
});
