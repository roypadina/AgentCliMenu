import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPeek } from '../../src/cli/peek.js';
import type { SessionRecord } from '../../src/core/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'transcripts', 'with-tools.jsonl');

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '');
}

const session: SessionRecord = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'sample',
  transcriptName: 'sample',
  cwd: '/tmp',
  cwdDecodeConfident: true,
  jsonlPath: fixture,
  sizeBytes: 0,
  startedAt: new Date('2026-05-22T11:00:00Z'),
  lastUpdatedAt: new Date('2026-05-22T12:00:00Z'),
  active: false,
  status: 'inactive',
};

describe('renderPeek', () => {
  it('renders a header and transcript turns', async () => {
    const out = stripAnsi(await renderPeek(session));
    expect(out).toContain('Session aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(out).toContain('2026-05-22T11:00:00');
    expect(out).toContain('[user] real question');
    expect(out).toContain('[assistant] reading file');
    expect(out).toContain('[summary] discussed hosts file');
  });
});
