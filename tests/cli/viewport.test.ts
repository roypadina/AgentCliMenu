import { describe, it, expect } from 'vitest';
import { windowFor, scrollbar } from '../../src/cli/viewport.js';

describe('windowFor', () => {
  it('shows everything when the list fits', () => {
    expect(windowFor(4, 0, 10)).toEqual({ start: 0, end: 4 });
  });

  it('centres the cursor once the list is longer than the view', () => {
    expect(windowFor(100, 50, 10)).toEqual({ start: 45, end: 55 });
  });

  it('clamps at both ends so the view is always full', () => {
    expect(windowFor(100, 0, 10)).toEqual({ start: 0, end: 10 });
    expect(windowFor(100, 99, 10)).toEqual({ start: 90, end: 100 });
  });

  it('handles an empty list', () => {
    expect(windowFor(0, 0, 10)).toEqual({ start: 0, end: 0 });
  });
});

describe('scrollbar', () => {
  it('renders nothing when everything fits', () => {
    expect(scrollbar(3, 0, 5)).toEqual(['', '', '', '', '']);
  });

  it('puts the thumb at the top, middle and bottom', () => {
    const size = 10;
    const top = scrollbar(100, 0, size);
    const bottom = scrollbar(100, 90, size);
    expect(top[0]).toBe('█');
    expect(top[size - 1]).toBe('│');
    expect(bottom[size - 1]).toBe('█');
    expect(bottom[0]).toBe('│');
  });

  it('always draws at least one thumb cell', () => {
    expect(scrollbar(10000, 5000, 4).filter(c => c === '█').length).toBeGreaterThanOrEqual(1);
  });

  it('returns one char per visible row', () => {
    expect(scrollbar(100, 10, 7)).toHaveLength(7);
  });
});
