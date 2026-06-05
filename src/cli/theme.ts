import type { SessionStatus } from '../core/types.js';

export const STATUS_DOT: Record<SessionStatus, string> = { busy: '●', idle: '●', inactive: '○' };
export const STATUS_COLOR: Record<SessionStatus, 'green' | 'yellow' | 'gray'> = {
  busy: 'green',
  idle: 'yellow',
  inactive: 'gray',
};
export const STATUS_LABEL: Record<SessionStatus, string> = { busy: 'busy', idle: 'idle', inactive: '' };

/** ink accepts hex strings for color=; pass through, default if blank. */
export function hexColor(hex: string | undefined, fallback = '#8888aa'): string {
  return hex && /^#?[0-9a-fA-F]{6}$/.test(hex) ? (hex.startsWith('#') ? hex : '#' + hex) : fallback;
}
