export interface Window {
  /** First visible index. */
  start: number;
  /** One past the last visible index. */
  end: number;
}

/** Scroll window that keeps `cursor` centred, clamped to the ends of the list. */
export function windowFor(total: number, cursor: number, size: number): Window {
  if (size <= 0 || total <= 0) return { start: 0, end: 0 };
  if (total <= size) return { start: 0, end: total };
  const start = Math.max(0, Math.min(total - size, cursor - Math.floor(size / 2)));
  return { start, end: start + size };
}

const TRACK = '│';
const THUMB = '█';

/**
 * One character per visible row: a scrollbar track with a thumb sized and placed by
 * scroll position. Empty strings when everything fits (nothing to scroll).
 */
export function scrollbar(total: number, start: number, size: number): string[] {
  if (size <= 0) return [];
  if (total <= size) return Array(size).fill('');
  const thumb = Math.max(1, Math.round((size * size) / total));
  const maxStart = total - size;
  const maxThumbTop = size - thumb;
  const top = maxStart <= 0 ? 0 : Math.round((start / maxStart) * maxThumbTop);
  return Array.from({ length: size }, (_, i) => (i >= top && i < top + thumb ? THUMB : TRACK));
}
