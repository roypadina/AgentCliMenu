import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../../src/cli/tui.js';
import type { SessionRecord } from '../../src/core/types.js';

function rec(id: string, name: string): SessionRecord {
  return {
    id, name, transcriptName: name, cwd: '/tmp',
    cwdDecodeConfident: true,
    kind: 'interactive' as const,
    jsonlPath: '/x.jsonl',
    sizeBytes: 0,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    active: false,
    status: 'inactive',
  };
}

/** Wait for ink's useEffect (setRawMode) to wire up, then write input and wait for re-render. */
async function sendKey(stdin: { write: (s: string) => void }, key: string): Promise<void> {
  await new Promise(r => setTimeout(r, 10));
  stdin.write(key);
  await new Promise(r => setTimeout(r, 10));
}

describe('App', () => {
  it('renders the session count and first session name', () => {
    const { lastFrame } = render(<App initial={[rec('aaaa1111-0000-0000-0000-000000000000', 'first')]} />);
    expect(lastFrame()).toContain('1 sessions');
    expect(lastFrame()).toContain('first');
  });

  it('cursor moves on arrow down', async () => {
    const { stdin, lastFrame } = render(
      <App initial={[
        rec('aaaa1111-0000-0000-0000-000000000000', 'first'),
        rec('bbbb2222-0000-0000-0000-000000000000', 'second'),
      ]} />
    );
    await sendKey(stdin, '\x1B[B');
    expect(lastFrame()).toContain('second');
  });

  it('filter mode shows the filter input', async () => {
    const { stdin, lastFrame } = render(
      <App initial={[rec('aaaa1111-0000-0000-0000-000000000000', 'first')]} />
    );
    await sendKey(stdin, '/');
    expect(lastFrame()).toContain('filter:');
  });
});

describe('long lists', () => {
  const many = Array.from({ length: 80 }, (_, i) =>
    rec(`${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`, `session-${i}`));

  /** ink writes to a fake stdout with no real rows; the code falls back to 30. */
  const TERM_ROWS = 30;

  it('never renders more rows than the terminal can show', () => {
    const { lastFrame } = render(<App initial={many} />);
    expect(lastFrame()!.split('\n').length).toBeLessThanOrEqual(TERM_ROWS);
  });

  it('keeps the highlighted row inside the window while paging down', async () => {
    const { stdin, lastFrame } = render(<App initial={many} />);
    await sendKey(stdin, 'G');                       // jump to the last session
    expect(lastFrame()).toContain('session-79');
    expect(lastFrame()).toContain('▶');
    expect(lastFrame()!.split('\n').length).toBeLessThanOrEqual(TERM_ROWS);
    await sendKey(stdin, 'g');                       // back to the first
    expect(lastFrame()).toContain('session-0');
  });

  it('shows a scroll position counter and a scrollbar thumb', () => {
    const { lastFrame } = render(<App initial={many} />);
    expect(lastFrame()).toContain('1/80');
    expect(lastFrame()).toContain('█');
  });

  it('one arrow press moves one row after the filter shrinks the list', async () => {
    const { stdin, lastFrame } = render(<App initial={many} />);
    await sendKey(stdin, 'G');                       // cursor at 79
    await sendKey(stdin, '/');                       // filter mode
    await sendKey(stdin, 'session-1');               // matches session-1, -10..-19
    await sendKey(stdin, '\r');                      // back to list mode
    // Without the cursor reset the selection would sit on the last match and ↓ would do nothing.
    expect(lastFrame()).toContain('1/');
    await sendKey(stdin, '\x1B[B');
    expect(lastFrame()).toContain('2/');
  });
});

describe('filter box owns plain letters', () => {
  const many = Array.from({ length: 80 }, (_, i) =>
    rec(`${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`, `jam-${i}`));

  it('typing j/k filters instead of moving the cursor', async () => {
    const { stdin, lastFrame } = render(<App initial={many} />);
    await sendKey(stdin, '/');
    await sendKey(stdin, 'j');
    expect(lastFrame()).toContain('filter j');
    expect(lastFrame()).toContain('1/80');   // still on the first match
    await sendKey(stdin, '\x1B[B');          // arrows still move
    expect(lastFrame()).toContain('2/80');
  });
});

describe('short terminals', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    rec(`${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`, `session-${i}`));

  /** ink's fake stdout reports no size, so the code falls back to 30 rows / 80 cols. */
  it('keeps the whole render inside the terminal even with a note and a recap on screen', () => {
    const annotated = many.map((r, i) => i === 0
      ? { ...r, annotation: { sessionId: r.id, flags: ['todo'], labels: [], done: false, hidden: false, deleted: false, note: 'a\nb\nc' } }
      : r);
    const { lastFrame } = render(<App initial={annotated} />);
    expect(lastFrame()!.split('\n').length).toBeLessThanOrEqual(30);
    expect(lastFrame()).toContain('resume');   // header survived
  });
});
