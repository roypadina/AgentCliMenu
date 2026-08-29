// THROWAWAY repro for the "scrolling hidden while filtering" bug report. Delete after diagnosis.
import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../../src/cli/tui.js';
import { NewScreen } from '../../src/cli/screens/NewScreen.js';
import type { SessionRecord } from '../../src/core/types.js';
import type { ProjectDir } from '../../src/core/groupScan.js';
import type { AgentCliMenuConfig } from '../../src/core/config/types.js';

const UP = '\x1B[A';
const DOWN = '\x1B[B';

async function sendKey(stdin: { write: (s: string) => void }, key: string): Promise<void> {
  await new Promise(r => setTimeout(r, 5));
  stdin.write(key);
  await new Promise(r => setTimeout(r, 5));
}

function rec(i: number, name: string): SessionRecord {
  return {
    id: `id-${String(i).padStart(2, '0')}`,
    name,
    cwd: '/tmp',
    cwdDecodeConfident: true,
    jsonlPath: '/x.jsonl',
    sizeBytes: 0,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    active: false,
    status: 'inactive',
  };
}

let origRows: number | undefined;
let origCols: number | undefined;

beforeAll(() => {
  origRows = process.stdout.rows;
  origCols = process.stdout.columns;
  Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });
  Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });
});
afterAll(() => {
  Object.defineProperty(process.stdout, 'rows', { value: origRows, configurable: true });
  Object.defineProperty(process.stdout, 'columns', { value: origCols, configurable: true });
});

describe('Resume screen (tui.tsx) scroll-after-filter repro', () => {
  it('cursor is stuck for 51 Up-presses after filtering shrinks the list', async () => {
    // 60 sessions, only 5 match "target" (rest never contain a "t" so they can never match).
    const sessions: SessionRecord[] = Array.from({ length: 60 }, (_, i) => {
      const isTarget = [10, 20, 30, 40, 50].includes(i);
      return rec(i, isTarget ? `target-${i}` : `sess${String(i).padStart(2, '0')}`);
    });
    const { stdin, lastFrame } = render(<App initial={sessions} />);

    // Scroll to the bottom of the full unfiltered list: cursor -> 55.
    for (let i = 0; i < 55; i++) await sendKey(stdin, DOWN);
    console.log('--- after 55x Down (unfiltered) ---\n' + lastFrame());
    expect(lastFrame()).toContain('56/60');

    // Enter filter mode and type "target" -> filtered.length becomes 5.
    await sendKey(stdin, '/');
    for (const ch of 'target') await sendKey(stdin, ch);
    console.log('--- while typing filter (mode=filter) ---\n' + lastFrame());
    await sendKey(stdin, '\r'); // commit filter, mode -> list
    const afterFilter = lastFrame()!;
    console.log('--- immediately after committing filter "target" ---\n' + afterFilter);
    // clamped = min(cursor=55, filtered.length-1=4) = 4 -> displayed as "5/5"
    expect(afterFilter).toContain('5/5');
    expect(afterFilter).toContain('target-50'); // last match, still selected (clamped to the end)

    // Press Up once: raw cursor state (55) is what setCursor operates on, not `clamped`.
    await sendKey(stdin, UP);
    const afterOneUp = lastFrame()!;
    console.log('--- after 1x Up (expect BUG: unchanged) ---\n' + afterOneUp);
    expect(afterOneUp).toContain('5/5'); // BUG: still stuck, selection has not visibly moved

    // 50 more Up presses (51 total) -- cursor now 55-51=4, clamped=min(4,4)=4 -> STILL "5/5".
    for (let i = 0; i < 50; i++) await sendKey(stdin, UP);
    const after51 = lastFrame()!;
    console.log('--- after 51x Up total (expect BUG: still unchanged) ---\n' + after51);
    expect(after51).toContain('5/5'); // BUG persists through 51 presses

    // The 52nd Up press is the first one that produces any visible movement.
    await sendKey(stdin, UP);
    const after52 = lastFrame()!;
    console.log('--- after 52x Up total (first visible movement) ---\n' + after52);
    expect(after52).toContain('4/5');
  });
});

describe('New screen (NewScreen.tsx) scroll-after-filter repro', () => {
  it('cursor is stuck for many Up-presses after typing a filter shrinks the list', async () => {
    const dirs: ProjectDir[] = Array.from({ length: 60 }, (_, i) => {
      const isTarget = [10, 20, 30, 40, 50].includes(i);
      const name = isTarget ? `target-${i}` : `dir${String(i).padStart(2, '0')}`;
      return {
        name,
        path: `/pp/${name}`,
        group: 'one',
        groupColor: '#ffffff',
        timeMs: Date.now() - i * 1000,
        scoreSource: 'mtime' as const,
      };
    });
    const config: AgentCliMenuConfig = {
      groups: [{ name: 'one', path: '/pp', pathRaw: '/pp', color: '#ffffff' }],
      tools: [{ name: 'cld', runs: 'true', label: '', color: '#ffffff' }],
      ides: [],
      defaultTool: 'cld',
      theme: { accent: '#fff', border: '#fff', pointer: '#fff', statusBusy: '#fff', statusIdle: '#fff', statusInactive: '#fff' },
      gui: { terminal: 'Terminal' },
    };
    const { stdin, lastFrame } = render(
      <NewScreen config={config} warnings={[]} projects={[dirs]} />
    );

    for (let i = 0; i < 55; i++) await sendKey(stdin, DOWN);
    console.log('--- New: after 55x Down (unfiltered) ---\n' + lastFrame());

    for (const ch of 'target') await sendKey(stdin, ch); // typing directly filters, no separate mode
    const afterFilter = lastFrame()!;
    console.log('--- New: immediately after typing "target" (live filter, no Enter) ---\n' + afterFilter);
    expect(afterFilter).toContain('(5)'); // query counter "(N)" next to the query text
    expect(selectedRowName(afterFilter)).toBe('target-50'); // clamped to the last match

    await sendKey(stdin, UP);
    const afterOneUp = lastFrame()!;
    console.log('--- New: after 1x Up (expect BUG: unchanged) ---\n' + afterOneUp);
    expect(selectedRowName(afterOneUp)).toBe('target-50'); // BUG: still the same row highlighted

    for (let i = 0; i < 50; i++) await sendKey(stdin, UP);
    const after51 = lastFrame()!;
    console.log('--- New: after 51x Up total (expect BUG: still unchanged) ---\n' + after51);
    expect(selectedRowName(after51)).toBe('target-50'); // BUG persists through 51 presses

    await sendKey(stdin, UP);
    const after52 = lastFrame()!;
    console.log('--- New: after 52x Up total (first visible movement) ---\n' + after52);
    expect(selectedRowName(after52)).toBe('target-40'); // finally moves, one row up
  });
});

/** Find the row marked with the "▸" pointer and pull out its dir name (first word after the marker). */
function selectedRowName(frame: string): string | undefined {
  const line = frame.split('\n').find(l => l.includes('▸'));
  const m = line?.match(/▸\s*(\S+)/);
  return m?.[1];
}
