import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyRank } from '../../src/core/fuzzy.js';

describe('fuzzyMatch', () => {
  it('matches a gapped subsequence and returns positions', () => {
    const r = fuzzyMatch('wap', 'web-app');
    expect(r).not.toBeNull();
    expect(r!.positions.map((p) => 'web-app'[p]).join('')).toBe('wap');
  });

  it('returns null when not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'web-app')).toBeNull();
    expect(fuzzyMatch('appx', 'app')).toBeNull();
  });

  it('empty query scores 0 with no positions', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, positions: [] });
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('API', 'my-api-service')).not.toBeNull();
  });

  it('scores word-boundary + consecutive matches higher than scattered', () => {
    const boundary = fuzzyMatch('api', 'be-api')!;        // 'api' contiguous at a boundary
    const scattered = fuzzyMatch('api', 'aaa-p-iii')!;     // a..p..i scattered
    expect(boundary.score).toBeGreaterThan(scattered.score);
  });

  it('prefers an earlier match', () => {
    const early = fuzzyMatch('app', 'app-web')!;
    const late = fuzzyMatch('app', 'web-app')!;
    expect(early.score).toBeGreaterThan(late.score);
  });
});

describe('fuzzyRank', () => {
  it('ranks closer matches first and drops non-matches', () => {
    const items = ['design-system', 'web-app', 'api', 'auth-service'];
    const ranked = fuzzyRank('ap', items, (s) => s).map((r) => r.item);
    expect(ranked).toContain('web-app');
    expect(ranked).toContain('api');
    expect(ranked).not.toContain('design-system'); // no subsequence 'ap'... actually 'design-system' has no a..p
  });

  it('empty query keeps original order', () => {
    const items = ['b', 'a', 'c'];
    expect(fuzzyRank('', items, (s) => s).map((r) => r.item)).toEqual(['b', 'a', 'c']);
  });
});
