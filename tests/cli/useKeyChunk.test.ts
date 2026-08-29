import { describe, it, expect } from 'vitest';
import { upCount, downCount } from '../../src/cli/useKeyChunk.js';

const UP = '\u001B[A';
const DOWN = '\u001B[B';

describe('key repeat counting', () => {
  it('counts every arrow in a chunk, not just the first', () => {
    expect(downCount(DOWN.repeat(5))).toBe(5);
    expect(upCount(UP.repeat(2))).toBe(2);
  });

  it('handles application-cursor-mode sequences', () => {
    expect(downCount('\u001BOB\u001BOB')).toBe(2);
    expect(upCount('\u001BOA')).toBe(1);
  });

  it('counts vim keys', () => {
    expect(downCount('jjj')).toBe(3);
    expect(upCount('kk')).toBe(2);
  });

  it('is 0 for an unrelated chunk', () => {
    expect(downCount('q')).toBe(0);
    expect(upCount('')).toBe(0);
  });

  it('nets out a mixed chunk', () => {
    const c = DOWN + DOWN + UP;
    expect(downCount(c) - upCount(c)).toBe(1);
  });
});
