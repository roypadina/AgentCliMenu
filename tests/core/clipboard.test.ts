import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyToClipboard, resumeCommand } from '../../src/core/clipboard.js';

describe('resumeCommand', () => {
  it('is a command you can paste into another terminal', () => {
    expect(resumeCommand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))
      .toBe('agentctl resume aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });
});

describe('copyToClipboard', () => {
  it('round-trips through the real clipboard, and puts back what was there', () => {
    if (process.platform !== 'darwin') return;
    // running the suite must not cost you whatever you had copied
    const previous = execFileSync('pbpaste', { encoding: 'utf8' });
    try {
      const marker = `agentctl-test-${Date.now()}`;
      expect(copyToClipboard(marker)).toBe(true);
      expect(execFileSync('pbpaste', { encoding: 'utf8' })).toBe(marker);
    } finally {
      copyToClipboard(previous);
    }
  });
});
