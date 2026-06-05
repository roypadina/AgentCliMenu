import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../../src/cli/tui.js';
import type { SessionRecord } from '../../src/core/types.js';

function rec(id: string, name: string): SessionRecord {
  return {
    id, name, cwd: '/tmp',
    cwdDecodeConfident: true,
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
