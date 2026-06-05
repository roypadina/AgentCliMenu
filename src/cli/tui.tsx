import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, render as inkRender } from 'ink';
import TextInput from 'ink-text-input';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { listSessions } from '../core/sessionRepo.js';
import { readTranscript } from '../core/transcript.js';
import { searchSessions, type SearchMatch } from '../core/search.js';
import { formatDate, timeAgo } from './format.js';
import { fuzzyRank } from '../core/fuzzy.js';
import type { SessionRecord, SessionStatus, TranscriptTurn } from '../core/types.js';

const STATUS_DOT: Record<SessionStatus, string> = { busy: '●', idle: '●', inactive: '○' };
const STATUS_COLOR: Record<SessionStatus, 'green' | 'yellow' | 'gray'> = {
  busy: 'green',
  idle: 'yellow',
  inactive: 'gray',
};
const STATUS_LABEL: Record<SessionStatus, string> = {
  busy: 'busy',
  idle: 'idle',
  inactive: '',
};

function tildify(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

type Mode = 'list' | 'filter' | 'peek' | 'search-input' | 'search-results';

interface AppProps {
  initial: SessionRecord[];
  /** Router hooks. When provided, the screen hands control back instead of spawning itself. */
  onResume?: (s: SessionRecord) => void;
  onBack?: () => void;
  onQuit?: () => void;
  /** ⇥ switches to the New tab (handled by AppShell). */
  onSwitchTab?: () => void;
}

export function App({ initial, onResume, onBack, onQuit, onSwitchTab }: AppProps) {
  const { exit } = useApp();

  const doResume = (s: SessionRecord) => {
    if (onResume) { onResume(s); return; }
    exit();
    const bin = process.env.CCSM_CLAUDE_BIN ?? 'claude';
    spawnSync(bin, ['--resume', s.id, '--dangerously-skip-permissions'], {
      cwd: s.cwd, stdio: 'inherit', env: process.env,
    });
  };
  const quit = () => { if (onQuit) onQuit(); else exit(); };
  const back = () => { if (onBack) onBack(); else exit(); };
  const [records, setRecords] = useState<SessionRecord[]>(initial);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [filter, setFilter] = useState('');
  const [peek, setPeek] = useState<TranscriptTurn[] | null>(null);
  const [peekOffset, setPeekOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCursor, setSearchCursor] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const filtered = filter
    ? fuzzyRank(filter, records, r => `${r.name}  ${tildify(r.cwd)}  ${r.id}`).map(x => x.item)
    : records;
  const clamped = Math.min(cursor, Math.max(0, filtered.length - 1));
  const [confirmResumeId, setConfirmResumeId] = useState<string | null>(null);
  const activeCount = records.filter(r => r.active).length;

  const cols = process.stdout.columns ?? 120;
  const rows = process.stdout.rows ?? 30;
  const peekWindow = Math.max(5, rows - 6);
  const maxPeekOffset = peek ? Math.max(0, peek.length - peekWindow) : 0;

  const stopSearch = () => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setSearching(false);
  };

  const startSearch = (q: string) => {
    stopSearch();
    if (!q.trim()) return;
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setSearchQuery(q);
    setSearchResults([]);
    setSearchCursor(0);
    setSearching(true);
    setMode('search-results');
    (async () => {
      try {
        for await (const m of searchSessions(records, q, { signal: ac.signal })) {
          if (ac.signal.aborted) break;
          setSearchResults(prev => [...prev, m]);
        }
      } finally {
        if (searchAbortRef.current === ac) {
          searchAbortRef.current = null;
          setSearching(false);
        }
      }
    })();
  };

  useEffect(() => () => { searchAbortRef.current?.abort(); }, []);

  useInput((input, key) => {
    if (mode === 'filter') {
      if (key.return || key.escape) setMode('list');
      return;
    }
    if (mode === 'search-input') {
      if (key.escape) { setMode('list'); return; }
      return;
    }
    if (mode === 'peek') {
      if (key.escape || input === 'p' || input === 'q') {
        setMode('list');
        setPeek(null);
        setPeekOffset(0);
        return;
      }
      if (key.upArrow || input === 'k') {
        setPeekOffset(o => Math.min(maxPeekOffset, o + 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setPeekOffset(o => Math.max(0, o - 1));
        return;
      }
      if (key.pageUp) { setPeekOffset(o => Math.min(maxPeekOffset, o + peekWindow)); return; }
      if (key.pageDown) { setPeekOffset(o => Math.max(0, o - peekWindow)); return; }
      if (input === 'g') { setPeekOffset(maxPeekOffset); return; }
      if (input === 'G') { setPeekOffset(0); return; }
      return;
    }
    if (mode === 'search-results') {
      if (key.escape || input === 'q') {
        stopSearch();
        setMode('list');
        return;
      }
      if (input === 'x' && searching) { stopSearch(); return; }
      if (input === 's' || input === '/') {
        stopSearch();
        setSearchInput(searchQuery);
        setMode('search-input');
        return;
      }
      if (key.upArrow || input === 'k') setSearchCursor(c => Math.max(0, c - 1));
      if (key.downArrow || input === 'j') setSearchCursor(c => Math.min(searchResults.length - 1, c + 1));
      if (input === 'p') {
        const hit = searchResults[searchCursor];
        if (hit) {
          readTranscript(hit.session.jsonlPath)
            .then(turns => { setPeek(turns); setPeekOffset(0); })
            .catch(() => { setPeek([]); setPeekOffset(0); });
          setMode('peek');
        }
      }
      if (key.return) {
        const hit = searchResults[searchCursor];
        if (!hit) return;
        stopSearch();
        doResume(hit.session);
      }
      return;
    }
    if (key.tab && onSwitchTab) { onSwitchTab(); return; }
    if (input === 'q') { quit(); return; }
    if (key.escape) { if (confirmResumeId) { setConfirmResumeId(null); return; } back(); return; }
    if (key.upArrow || input === 'k') { setCursor(c => Math.max(0, c - 1)); setConfirmResumeId(null); }
    if (key.downArrow || input === 'j') { setCursor(c => Math.min(filtered.length - 1, c + 1)); setConfirmResumeId(null); }
    if (input === '/') setMode('filter');
    if (input === 's') {
      setSearchInput(searchQuery);
      setMode('search-input');
    }
    if (input === 'p') {
      const s = filtered[clamped];
      if (s) {
        readTranscript(s.jsonlPath)
          .then(turns => { setPeek(turns); setPeekOffset(0); })
          .catch(() => { setPeek([]); setPeekOffset(0); });
        setMode('peek');
      }
    }
    if (input === 'r') {
      listSessions().then(setRecords).catch(() => { /* noop */ });
    }
    if (key.return) {
      const s = filtered[clamped];
      if (!s) return;
      // cwd-confidence gate: decoded cwd may be wrong — confirm before resuming into it.
      if (!s.cwdDecodeConfident && confirmResumeId !== s.id) { setConfirmResumeId(s.id); return; }
      doResume(s);
    }
  });

  const cardLines = 3;
  const chromeLines = 8;
  const visibleCards = Math.max(3, Math.floor((rows - chromeLines) / cardLines));
  const start = Math.max(
    0,
    Math.min(Math.max(0, filtered.length - visibleCards), clamped - Math.floor(visibleCards / 2)),
  );
  const view = filtered.slice(start, start + visibleCards);

  const renderHeader = () => (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">ccsm</Text>
        <Text dimColor>   </Text>
        <Text color="white">{records.length}</Text>
        <Text dimColor> sessions  ·  </Text>
        <Text color="green">{activeCount}</Text>
        <Text dimColor> active</Text>
        {filter ? (
          <>
            <Text dimColor>  ·  filter </Text>
            <Text color="yellow">{filter}</Text>
          </>
        ) : null}
        {mode !== 'search-results' ? (
          <>
            <Text dimColor>  ·  </Text>
            <Text color="gray">{clamped + 1}/{filtered.length}</Text>
          </>
        ) : null}
      </Box>
      <Box>
        <Text color="green">●</Text>
        <Text dimColor> busy   </Text>
        <Text color="yellow">●</Text>
        <Text dimColor> idle   </Text>
        <Text color="gray">○</Text>
        <Text dimColor> inactive</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      {renderHeader()}

      {mode === 'filter' ? (
        <Box marginTop={1}>
          <Text color="yellow">filter: </Text>
          <TextInput value={filter} onChange={setFilter} onSubmit={() => setMode('list')} />
        </Box>
      ) : null}

      {mode === 'search-input' ? (
        <Box marginTop={1}>
          <Text color="magenta">search: </Text>
          <TextInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={(v) => { startSearch(v); }}
          />
          <Text dimColor>   (enter to run, esc to cancel)</Text>
        </Box>
      ) : null}

      {mode === 'list' || mode === 'filter' ? (
        <Box marginTop={1} flexDirection="column">
          {start > 0 ? <Text dimColor>  ▲ {start} more above</Text> : null}
          {view.map((r, i) => {
            const isSel = start + i === clamped;
            return <Card key={r.id} r={r} selected={isSel} />;
          })}
          {start + visibleCards < filtered.length
            ? <Text dimColor>  ▼ {filtered.length - (start + visibleCards)} more below</Text> : null}
          {filtered.length === 0 ? (
            <Text dimColor>{records.length === 0 ? '(no sessions yet)' : `(no matches for "${filter}")`}</Text>
          ) : null}
          {confirmResumeId && filtered[clamped]?.id === confirmResumeId ? (
            <Box marginTop={1}>
              <Text color="yellow">⚠ cwd uncertain for this session — </Text>
              <Text bold color="yellow">Enter</Text>
              <Text color="yellow"> again to resume anyway, </Text>
              <Text bold color="yellow">esc</Text>
              <Text color="yellow"> to cancel</Text>
            </Box>
          ) : null}
        </Box>
      ) : null}

      {mode === 'search-results' ? (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="magenta">🔍 </Text>
            <Text color="white" bold>{searchQuery}</Text>
            <Text dimColor>   </Text>
            <Text color="cyan">{searchResults.length}</Text>
            <Text dimColor> matches</Text>
            {searching ? (
              <>
                <Text dimColor>   </Text>
                <Text color="yellow">searching…</Text>
                <Text dimColor>   x stop</Text>
              </>
            ) : (
              <>
                <Text dimColor>   </Text>
                <Text color="green">done</Text>
              </>
            )}
            <Text dimColor>   s/.  new search   ·  esc back</Text>
          </Box>
          {searchResults.length === 0 ? (
            <Box marginTop={1}>
              <Text dimColor>{searching ? '(no matches yet)' : '(no matches)'}</Text>
            </Box>
          ) : (
            <Box marginTop={1} flexDirection="column">
              {searchResults.map((m, i) => {
                const isSel = i === searchCursor;
                const marker = isSel ? '▶' : ' ';
                return (
                  <Box key={m.session.id + ':' + m.matchedLine} flexDirection="column">
                    <Box>
                      <Text bold color={isSel ? 'yellow' : 'gray'}>{marker} </Text>
                      <Text color={STATUS_COLOR[m.session.status]} bold>{STATUS_DOT[m.session.status]}</Text>
                      <Text>  </Text>
                      <Text bold color={isSel ? 'cyan' : 'white'}>{m.session.name}</Text>
                      <Text dimColor>   </Text>
                      <Text color="magenta">{m.session.id.slice(0, 8)}</Text>
                      <Text dimColor>   </Text>
                      <Text color="cyan">{formatDate(m.session.lastUpdatedAt)}</Text>
                      <Text dimColor> (</Text>
                      <Text color="yellow">{timeAgo(m.session.lastUpdatedAt)}</Text>
                      <Text dimColor>)</Text>
                    </Box>
                    <Box marginLeft={4}>
                      <Text dimColor>… </Text>
                      <Text color={isSel ? 'white' : 'gray'}>{highlight(m.excerpt, searchQuery, cols - 10)}</Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      ) : null}

      {mode === 'peek' && peek ? (() => {
        const total = peek.length;
        const end = total - peekOffset;
        const sliceStart = Math.max(0, end - peekWindow);
        const visible = peek.slice(sliceStart, end);
        const sel = mode === 'peek'
          ? (searchResults[searchCursor]?.session ?? filtered[clamped])
          : null;
        return (
          <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
            <Box>
              <Text bold color="cyan">peek </Text>
              {sel ? <Text bold color="white">{sel.name}</Text> : null}
              <Text dimColor>   showing </Text>
              <Text color="cyan">{sliceStart + 1}</Text>
              <Text dimColor>–</Text>
              <Text color="cyan">{end}</Text>
              <Text dimColor> of </Text>
              <Text color="cyan">{total}</Text>
              <Text dimColor>   ↑ older  ·  ↓ newer  ·  pgup/pgdn  ·  g top  ·  G bottom  ·  esc close</Text>
            </Box>
            {visible.length === 0 ? (
              <Text dimColor>(empty)</Text>
            ) : visible.map((t, i) => {
              const color = t.role === 'user'
                ? 'cyan'
                : t.role === 'assistant'
                  ? 'green'
                  : t.role === 'tool'
                    ? 'yellow'
                    : 'gray';
              const oneLine = t.text.replace(/[\r\n]+/g, ' ⏎ ').replace(/\s+/g, ' ').trim();
              const tag = `[${t.role}] `;
              const budget = Math.max(20, cols - 6 - tag.length);
              const text = oneLine.length > budget ? oneLine.slice(0, budget - 1) + '…' : oneLine;
              return (
                <Box key={sliceStart + i}>
                  <Text color={color}>{tag}</Text>
                  <Text>{text}</Text>
                </Box>
              );
            })}
          </Box>
        );
      })() : null}

      {mode !== 'peek' && mode !== 'search-input' ? (
        <Box marginTop={1}>
          {mode === 'search-results' ? (
            <>
              <Text dimColor>↑/↓ </Text>
              <Text color="white">move</Text>
              <Text dimColor>  ·  enter </Text>
              <Text color="white">resume</Text>
              <Text dimColor>  ·  p </Text>
              <Text color="white">peek</Text>
              <Text dimColor>  ·  s </Text>
              <Text color="white">new search</Text>
              {searching ? (
                <>
                  <Text dimColor>  ·  x </Text>
                  <Text color="white">stop</Text>
                </>
              ) : null}
              <Text dimColor>  ·  esc </Text>
              <Text color="white">back</Text>
            </>
          ) : (
            <>
              <Text dimColor>↑/↓ </Text>
              <Text color="white">move</Text>
              <Text dimColor>  ·  enter </Text>
              <Text color="white">resume</Text>
              <Text dimColor>  ·  p </Text>
              <Text color="white">peek</Text>
              <Text dimColor>  ·  / </Text>
              <Text color="white">filter</Text>
              <Text dimColor>  ·  s </Text>
              <Text color="white">search</Text>
              <Text dimColor>  ·  r </Text>
              <Text color="white">refresh</Text>
              <Text dimColor>  ·  q </Text>
              <Text color="white">quit</Text>
            </>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

function Card({ r, selected }: { r: SessionRecord; selected: boolean }) {
  const marker = selected ? '▶' : ' ';
  const updated = formatDate(r.lastUpdatedAt);
  const started = formatDate(r.startedAt);
  const ago = timeAgo(r.lastUpdatedAt);
  const statusLabel = STATUS_LABEL[r.status];
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box>
        <Text bold color={selected ? 'yellow' : 'gray'}>{marker} </Text>
        <Text color={STATUS_COLOR[r.status]} bold>{STATUS_DOT[r.status]}</Text>
        <Text>  </Text>
        {!r.cwdDecodeConfident ? <Text color="yellow">⚠ </Text> : null}
        <Text bold color={selected ? 'cyan' : 'white'}>{r.name}</Text>
        {statusLabel ? (
          <>
            <Text dimColor>   </Text>
            <Text color={STATUS_COLOR[r.status]}>· {statusLabel}</Text>
          </>
        ) : null}
      </Box>
      <Box marginLeft={4}>
        <Text color="magenta">{r.id}</Text>
        <Text dimColor>   updated </Text>
        <Text color="cyan">{updated}</Text>
        <Text dimColor> (</Text>
        <Text color="yellow">{ago}</Text>
        <Text dimColor>)   started </Text>
        <Text color="blue">{started}</Text>
      </Box>
      <Box marginLeft={4}>
        <Text color="green">{tildify(r.cwd)}</Text>
        {r.gitBranch ? (
          <>
            <Text dimColor>   ⎇ </Text>
            <Text color="magenta">{r.gitBranch}</Text>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

function highlight(text: string, query: string, maxLen: number): string {
  const t = text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
  return t;
}

export async function runTui(): Promise<void> {
  const records = await listSessions();
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  const { waitUntilExit } = inkRender(<App initial={records} />);
  await waitUntilExit();
}
