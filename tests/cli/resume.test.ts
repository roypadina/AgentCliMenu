import { describe, it, expect, vi } from 'vitest';
import { resume, ResumeError } from '../../src/cli/resume.js';
import type { SessionRecord } from '../../src/core/types.js';

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'x',
    transcriptName: 'x',
    cwd: '/tmp',
    cwdDecodeConfident: true,
    jsonlPath: '/x.jsonl',
    sizeBytes: 0,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    active: false,
    status: 'inactive',
    ...overrides,
  };
}

describe('resume', () => {
  it('throws ResumeError(3) when cwd does not exist', () => {
    const exit = vi.fn();
    expect(() =>
      resume(record({ cwd: '/no/such/dir' }), {}, {
        exists: () => false,
        spawn: vi.fn() as never,
        exit: exit as never,
      })
    ).toThrow(ResumeError);
  });

  it('refuses busy active session without --yes', () => {
    expect(() =>
      resume(record({ active: true, status: 'busy' }), {}, {
        exists: () => true,
        spawn: vi.fn() as never,
        exit: vi.fn() as never,
      })
    ).toThrow(/busy/);
  });

  it('spawns claude with --resume and --dangerously-skip-permissions', () => {
    const spawn = vi.fn(() => ({ status: 0, error: undefined })) as never;
    const exit = vi.fn();
    resume(record(), {}, { exists: () => true, spawn, exit: exit as never });
    expect(spawn).toHaveBeenCalledOnce();
    const call = (spawn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe('claude');
    expect(call[1]).toEqual([
      '--resume',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '--dangerously-skip-permissions',
    ]);
    expect((call[2] as { cwd: string }).cwd).toBe('/tmp');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('throws ResumeError(127) when claude binary missing', () => {
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    const spawn = vi.fn(() => ({ status: null, error: enoent })) as never;
    expect(() =>
      resume(record(), {}, {
        exists: () => true,
        spawn,
        exit: vi.fn() as never,
      })
    ).toThrow(/not found on PATH/);
  });
});
