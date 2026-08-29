import { describe, it, expect } from 'vitest';
import { renderTable } from '../../src/cli/render.js';
import type { SessionRecord } from '../../src/core/types.js';

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '');
}

const sample: SessionRecord = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'first session',
  transcriptName: 'first session',
  cwd: '/Users/me/proj',
  cwdDecodeConfident: true,
  jsonlPath: '/x',
  sizeBytes: 0,
  startedAt: new Date(Date.now() - 60_000),
  lastUpdatedAt: new Date(Date.now() - 60_000),
  active: false,
  status: 'inactive',
};

describe('renderTable', () => {
  it('returns a placeholder when there are no records', () => {
    expect(stripAnsi(renderTable([]))).toBe('(no sessions)');
  });

  it('includes the name, short id, tilde-shortened cwd, and date columns', () => {
    const out = stripAnsi(renderTable([sample]));
    expect(out).toContain('first session');
    expect(out).toContain('aaaaaaaa');
    expect(out).toMatch(/\/Users\/me\/proj/);
    expect(out).toMatch(/UPDATED/);
    expect(out).toMatch(/STARTED/);
    expect(out).toMatch(/1m\b/);
    expect(out).toMatch(/[A-Z][a-z]{2} \d{2} \d{2}:\d{2}/);
  });
});
