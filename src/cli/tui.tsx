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
import { getRecap, readCachedRecap, spawnRun } from '../core/recap.js';
import { windowFor, scrollbar } from './viewport.js';
import { useKeyChunk, upCount, downCount } from './useKeyChunk.js';
import { writeAnnotation, parseWhen, isReminderDue, type AnnotationPatch } from '../core/annotations.js';
import type { SessionRecord, SessionStatus, TranscriptTurn } from '../core/types.js';

interface RecapState { text?: string; loading?: boolean; error?: string }

const STATUS_DOT: Record<SessionStatus, string> = { busy: '●', idle: '●', inactive: '○' };
const STATUS_COLOR: Record<SessionStatus, 'green' | 'yellow' | 'gray'> = {
  busy: 'green',
  idle: 'yellow',
  inactive: 'gray',
};

function tildify(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

type Mode = 'list' | 'filter' | 'peek' | 'search-input' | 'search-results' | 'help' | 'annotate';
type PromptKind = 'name' | 'note' | 'flag' | 'remind';

const PROMPTS: Record<PromptKind, string> = {
  name: 'name (empty clears the override): ',
  note: 'note (empty clears it): ',
  flag: 'flags, space separated (-flag removes one, empty clears all): ',
  remind: 'remind me in / at — 2h, tomorrow 9am, 17:00 (empty clears): ',
};

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
  const [peekFrom, setPeekFrom] = useState<'list' | 'search'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCursor, setSearchCursor] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [prompt, setPrompt] = useState<{ kind: PromptKind; value: string } | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);

  const visible = hideDone ? records.filter(r => !r.annotation?.done) : records;
  const haystack = (r: SessionRecord) =>
    `${r.name}  ${tildify(r.cwd)}  ${r.id}  ${(r.annotation?.flags ?? []).map(f => '#' + f).join(' ')}  ${r.annotation?.note ?? ''}`;
  const filtered = filter ? fuzzyRank(filter, visible, haystack).map(x => x.item) : visible;
  const clamped = Math.min(cursor, Math.max(0, filtered.length - 1));
  // Re-filtering shrinks the list under the cursor. Snap back to the top, otherwise the stale
  // index leaves the selection pinned to the last row and ↑ looks dead until it counts down.
  useEffect(() => { setCursor(0); }, [filter]);
  const [confirmResumeId, setConfirmResumeId] = useState<string | null>(null);
  const activeCount = records.filter(r => r.active).length;
  const doneCount = records.filter(r => r.annotation?.done).length;

  /** Apply an annotation patch to the highlighted session and refresh it in place. */
  const annotate = (s: SessionRecord, patch: AnnotationPatch) => {
    const a = writeAnnotation(s.id, patch);
    setRecords(rs => rs.map(r => (r.id === s.id ? { ...r, annotation: a, name: a.name ?? r.transcriptName } : r)));
  };

  const openPrompt = (kind: PromptKind) => {
    const s = filtered[clamped];
    if (!s) return;
    const a = s.annotation;
    const value = kind === 'name' ? (a?.name ?? '')
      : kind === 'note' ? (a?.note ?? '')
      : kind === 'flag' ? (a?.flags ?? []).join(' ')
      : '';
    setPrompt({ kind, value });
    setPromptError(null);
    setMode('annotate');
  };

  const submitPrompt = (raw: string) => {
    const s = filtered[clamped];
    const kind = prompt?.kind;
    if (!s || !kind) { setMode('list'); setPrompt(null); return; }
    const v = raw.trim();
    let patch: AnnotationPatch;
    if (kind === 'name') patch = { name: v || null };
    else if (kind === 'note') patch = { note: v || null };
    else if (kind === 'flag') {
      if (!v) patch = { removeFlags: s.annotation?.flags ?? [] };
      else {
        const words = v.split(/\s+/);
        patch = {
          addFlags: words.filter(w => !w.startsWith('-')),
          removeFlags: words.filter(w => w.startsWith('-')).map(w => w.slice(1)),
        };
      }
    } else {
      if (!v) patch = { remindAt: null };
      else {
        const at = parseWhen(v);
        if (!at) { setPromptError(`can't read a time out of "${v}"`); return; }
        patch = { remindAt: at.toISOString() };
      }
    }
    annotate(s, patch);
    setMode('list');
    setPrompt(null);
    setPromptError(null);
  };

  // Recap (R): generated lazily via `claude -p` (haiku) and cached. The highlighted row auto-shows
  // a cached recap if one exists; R generates/refreshes it. State is keyed by session id.
  const [recaps, setRecaps] = useState<Record<string, RecapState>>({});
  const selId = filtered[clamped]?.id;
  useEffect(() => {
    if (selId && recaps[selId] === undefined) {
      const cached = readCachedRecap(selId);
      if (cached) setRecaps(p => ({ ...p, [selId]: { text: cached.text } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  const runRecap = (s: SessionRecord, refresh = false) => {
    if (recaps[s.id]?.loading) return;
    setRecaps(p => ({ ...p, [s.id]: { loading: true } }));
    getRecap({ id: s.id, jsonlPath: s.jsonlPath }, { refresh }, { run: spawnRun() })
      .then(r => setRecaps(p => ({ ...p, [s.id]: { text: r.text } })))
      .catch(e => setRecaps(p => ({ ...p, [s.id]: { error: e instanceof Error ? e.message : 'recap failed' } })));
  };

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

  const keyChunk = useKeyChunk();

  useInput((input, key) => {
    // One stdin chunk can carry many presses (held-down arrow); ink only parses the first.
    const moved = downCount(keyChunk.current) - upCount(keyChunk.current);
    if (mode === 'help') { setMode('list'); return; } // any key closes
    if (mode === 'filter') {
      if (key.return || key.escape) { setMode('list'); return; }
      // fzf-style: arrow through the narrowed list without leaving the filter box
      // (ink-text-input only claims ←/→, so ↑/↓ are ours).
      if (moved !== 0) setCursor(Math.max(0, Math.min(filtered.length - 1, clamped + moved)));
      return;
    }
    if (mode === 'search-input') {
      if (key.escape) { setMode('list'); return; }
      return;
    }
    if (mode === 'annotate') {
      if (key.escape) { setMode('list'); setPrompt(null); setPromptError(null); }
      return; // TextInput owns the rest
    }
    if (mode === 'peek') {
      if (key.escape || input === 'p' || input === 'q') {
        setMode('list');
        setPeek(null);
        setPeekOffset(0);
        return;
      }
      if (moved !== 0) {
        setPeekOffset(o => Math.max(0, Math.min(maxPeekOffset, o - moved)));
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
      if (moved !== 0) setSearchCursor(c => Math.max(0, Math.min(searchResults.length - 1, c + moved)));
      if (key.pageUp) setSearchCursor(c => Math.max(0, c - searchPerView));
      if (key.pageDown) setSearchCursor(c => Math.min(searchResults.length - 1, c + searchPerView));
      if (input === 'g') setSearchCursor(0);
      if (input === 'G') setSearchCursor(Math.max(0, searchResults.length - 1));
      if (input === 'p') {
        const hit = searchResults[searchCursor];
        if (hit) {
          readTranscript(hit.session.jsonlPath)
            .then(turns => { setPeek(turns); setPeekOffset(0); })
            .catch(() => { setPeek([]); setPeekOffset(0); });
          setPeekFrom('search');
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
    if (input === '?') { setMode('help'); return; }
    if (key.escape) {
      if (confirmResumeId) { setConfirmResumeId(null); return; }
      if (filter) { setFilter(''); setCursor(0); return; } // clear filter first (matches New + GUI)
      back();
      return;
    }
    if (moved !== 0) {
      setCursor(Math.max(0, Math.min(filtered.length - 1, clamped + moved)));
      setConfirmResumeId(null);
    }
    if (key.pageUp) { setCursor(Math.max(0, clamped - rowsPerView)); setConfirmResumeId(null); }
    if (key.pageDown) { setCursor(Math.min(filtered.length - 1, clamped + rowsPerView)); setConfirmResumeId(null); }
    if (input === 'g') { setCursor(0); setConfirmResumeId(null); }
    if (input === 'G') { setCursor(Math.max(0, filtered.length - 1)); setConfirmResumeId(null); }
    if (input === '/') setMode('filter');
    if (input === 'e') { openPrompt('name'); return; }
    if (input === 'n') { openPrompt('note'); return; }
    if (input === 'f') { openPrompt('flag'); return; }
    if (input === 't') { openPrompt('remind'); return; }
    if (input === 'd') {
      const sel = filtered[clamped];
      if (sel) annotate(sel, { done: !sel.annotation?.done });
      return;
    }
    if (input === 'h') { setHideDone(v => !v); setCursor(0); return; }
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
        setPeekFrom('list');
        setMode('peek');
      }
    }
    if (key.ctrl && input === 'r') {
      listSessions().then(setRecords).catch(() => { /* noop */ });
    }
    if ((input === 'r' || input === 'R') && !key.ctrl) {
      const s = filtered[clamped];
      if (s) runRecap(s, !!recaps[s.id]?.text); // refresh if one is already shown
    }
    if (key.return) {
      const s = filtered[clamped];
      if (!s) return;
      // cwd-confidence gate: decoded cwd may be wrong — confirm before resuming into it.
      if (!s.cwdDecodeConfident && confirmResumeId !== s.id) { setConfirmResumeId(s.id); return; }
      doResume(s);
    }
  });

  // Table column widths (cwd flex-fills the rest). ink truncates each cell to its Box width.
  const tableInner = Math.max(48, cols - 4);
  const wBranch = 12;
  const wUsed = 14; // "Jun 09 10:43"
  const wName = Math.max(16, Math.min(44, Math.floor((tableInner - 4 - 2 - 4 - wBranch - wUsed) * 0.5)));
  // The list is the ONLY elastic block on screen, so its height is whatever the fixed chrome
  // and the (content-sized) details pane leave over. Guessing a constant here is what pushed
  // the header off-screen whenever a note, a recap or a prompt appeared.
  const sel = filtered[clamped];
  const selRecap = sel ? recaps[sel.id] : undefined;
  const recapBodyLines = selRecap?.text
    ? Math.min(6, selRecap.text.split('\n').filter(l => l.trim()).length)
    : 1;
  const noteLines = sel?.annotation?.note ? Math.min(3, sel.annotation.note.split('\n').length) : 0;
  const detailsHeight = sel
    ? 2 + 4 + (sel.annotation ? 1 : 0) + noteLines + 1 + recapBodyLines +
      (confirmResumeId === sel.id ? 1 : 0)
    : 0;
  const CHROME = 10; // tab bar 2 + header 2 + gap 1 + table border/header 3 + footer 2
  const promptHeight = mode === 'filter' ? 2 : mode === 'annotate' ? (promptError ? 3 : 2) : 0;
  const rowsPerView = Math.max(3, rows - CHROME - detailsHeight - promptHeight);
  const { start, end: viewEnd } = windowFor(filtered.length, clamped, rowsPerView);
  const view = filtered.slice(start, viewEnd);
  const listBar = scrollbar(filtered.length, start, view.length);
  // Search hits are two lines each and used to render ALL at once, overflowing any terminal.
  const searchPerView = Math.max(2, Math.floor((rows - 10) / 2));
  const { start: searchStart, end: searchEnd } = windowFor(searchResults.length, searchCursor, searchPerView);
  const searchView = searchResults.slice(searchStart, searchEnd);

  const renderHeader = () => (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">resume</Text>
        <Text dimColor>   </Text>
        <Text color="white">{records.length}</Text>
        <Text dimColor> sessions  ·  </Text>
        <Text color="green">{activeCount}</Text>
        <Text dimColor> active</Text>
        {doneCount > 0 ? (
          <>
            <Text dimColor>  ·  </Text>
            <Text color="green">{doneCount}</Text>
            <Text dimColor> done{hideDone ? ' (hidden)' : ''}</Text>
          </>
        ) : null}
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

      {mode === 'annotate' && prompt ? (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="yellow">{PROMPTS[prompt.kind]}</Text>
            <TextInput
              value={prompt.value}
              onChange={(v) => setPrompt(p => (p ? { ...p, value: v } : p))}
              onSubmit={submitPrompt}
            />
          </Box>
          {promptError ? <Text color="red">{promptError}</Text> : null}
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

      {mode === 'list' || mode === 'filter' || mode === 'annotate' ? (
        <Box marginTop={1} flexDirection="column">
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
            <TableHeader wName={wName} wBranch={wBranch} wUsed={wUsed} />
            {view.map((r, i) => (
              <Row key={r.id} r={r} selected={start + i === clamped} wName={wName} wBranch={wBranch} wUsed={wUsed} bar={listBar[i]} />
            ))}
            {filtered.length === 0 ? (
              <Text dimColor>{records.length === 0 ? '(no sessions yet)' : `(no matches for "${filter}")`}</Text>
            ) : null}
          </Box>
          {filtered[clamped] ? (
            <DetailsPane
              s={filtered[clamped]}
              recap={recaps[filtered[clamped].id]}
              confirming={confirmResumeId === filtered[clamped].id}
            />
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
            {searchResults.length > 0 ? (
              <>
                <Text dimColor>   </Text>
                <Text color="gray">{searchCursor + 1}/{searchResults.length}</Text>
              </>
            ) : null}
            <Text dimColor>   s/.  new search   ·  esc back</Text>
          </Box>
          {searchResults.length === 0 ? (
            <Box marginTop={1}>
              <Text dimColor>{searching ? '(no matches yet)' : '(no matches)'}</Text>
            </Box>
          ) : (
            <Box marginTop={1} flexDirection="column">
              {searchView.map((m, vi) => {
                const i = searchStart + vi;
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

      {mode === 'help' ? (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">keys — Resume</Text>
          <HelpRow k="↑/↓  j/k" v="move selection" />
          <HelpRow k="pgup/pgdn" v="page through the list" />
          <HelpRow k="g / G" v="jump to first / last" />
          <HelpRow k="enter" v="resume the selected session" />
          <HelpRow k="r" v="recap the session (claude -p · haiku, cached)" />
          <HelpRow k="p" v="peek transcript (↑/↓ · g/G · pgup/pgdn to scroll)" />
          <HelpRow k="/" v="fuzzy-filter the list" />
          <HelpRow k="s" v="full-text search across all transcripts" />
          <HelpRow k="e / n" v="edit name / note" />
          <HelpRow k="f / t" v="flags / reminder" />
          <HelpRow k="d / h" v="toggle done / hide done" />
          <HelpRow k="^r" v="refresh sessions" />
          <HelpRow k="⇥ tab" v="switch to New" />
          <HelpRow k="q" v="quit" />
          <Box marginTop={1}><Text dimColor>⚠ = decoded cwd uncertain — Enter twice to resume anyway.  press any key to close</Text></Box>
        </Box>
      ) : null}

      {mode === 'peek' && peek ? (() => {
        const wide = cols >= 120;
        const railW = wide ? 34 : 0;
        const peekCols = wide ? cols - railW - 5 : cols;
        const total = peek.length;
        const end = total - peekOffset;
        const sliceStart = Math.max(0, end - peekWindow);
        const visible = peek.slice(sliceStart, end);
        const fromSearch = peekFrom === 'search' && !!searchResults[searchCursor];
        const sel = fromSearch ? searchResults[searchCursor].session : filtered[clamped];

        const peekBox = (
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} flexGrow={1}>
            <Box>
              <Text bold color="cyan">peek </Text>
              {sel ? <Text bold color="white">{sel.name}</Text> : null}
              <Text dimColor>   </Text>
              <Text color="cyan">{sliceStart + 1}</Text>
              <Text dimColor>–</Text>
              <Text color="cyan">{end}</Text>
              <Text dimColor> of </Text>
              <Text color="cyan">{total}</Text>
              <Text dimColor>   ↑ older · ↓ newer · pgup/pgdn · g/G · esc close</Text>
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
              const budget = Math.max(20, peekCols - 6 - tag.length);
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

        if (!wide) return <Box marginTop={1}>{peekBox}</Box>;

        // Wide terminal: keep a slim session rail on the left for context while reading.
        const list = fromSearch ? searchResults.map((m) => m.session) : filtered;
        const cur = fromSearch ? searchCursor : clamped;
        const railStart = Math.max(0, Math.min(Math.max(0, list.length - peekWindow), cur - Math.floor(peekWindow / 2)));
        const railSlice = list.slice(railStart, railStart + peekWindow);
        return (
          <Box marginTop={1} flexDirection="row">
            <Box flexDirection="column" width={railW} marginRight={1}>
              {railSlice.map((r, i) => {
                const isSel = railStart + i === cur;
                const name = r.name.length > railW - 4 ? r.name.slice(0, railW - 5) + '…' : r.name;
                return (
                  <Box key={r.id}>
                    <Text bold color={isSel ? 'yellow' : 'gray'}>{isSel ? '▶ ' : '  '}</Text>
                    <Text color={STATUS_COLOR[r.status]}>{STATUS_DOT[r.status]}</Text>
                    <Text> </Text>
                    <Text color={isSel ? 'cyan' : 'white'}>{name}</Text>
                  </Box>
                );
              })}
            </Box>
            {peekBox}
          </Box>
        );
      })() : null}

      {mode === 'peek' && !peek ? (
        <Box marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">peek </Text>
          <Text dimColor>loading transcript…</Text>
        </Box>
      ) : null}

      {mode !== 'peek' && mode !== 'search-input' && mode !== 'help' ? (
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
              <Text dimColor>↑/↓ </Text><Text color="white">move</Text>
              <Text dimColor> · ⏎ </Text><Text color="white">resume</Text>
              <Text dimColor> · r </Text><Text color="white">recap</Text>
              <Text dimColor> · p </Text><Text color="white">peek</Text>
              <Text dimColor> · / </Text><Text color="white">filter</Text>
              <Text dimColor> · s </Text><Text color="white">search</Text>
              <Text dimColor> · e/n/f/t/d </Text><Text color="white">annotate</Text>
              <Text dimColor> · ? </Text><Text color="white">help</Text>
              <Text dimColor> · q </Text><Text color="white">quit</Text>
            </>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

function TableHeader({ wName, wBranch, wUsed }: { wName: number; wBranch: number; wUsed: number }) {
  return (
    <Box>
      <Box width={4} flexShrink={0}><Text dimColor bold>ST</Text></Box>
      <Box width={2} flexShrink={0}><Text dimColor bold> </Text></Box>
      <Box width={wName} marginRight={1} flexShrink={0}><Text dimColor bold>NAME</Text></Box>
      <Box width={4} flexShrink={0}><Text dimColor bold> </Text></Box>
      <Box width={wBranch} marginRight={1} flexShrink={0}><Text dimColor bold>BRANCH</Text></Box>
      <Box width={wUsed} marginRight={1} flexShrink={0}><Text dimColor bold>LAST USED</Text></Box>
      <Box flexGrow={1} minWidth={0}><Text dimColor bold>CWD</Text></Box>
      <Box width={1} flexShrink={0}><Text dimColor> </Text></Box>
    </Box>
  );
}

/** One-cell marks for the annotation state. Every glyph here measures 1 column. */
function badgeMarks(r: SessionRecord): Array<{ ch: string; color: string }> {
  const a = r.annotation;
  if (!a) return [];
  const out: Array<{ ch: string; color: string }> = [];
  if (a.done) out.push({ ch: '✓', color: 'green' });
  if (a.flags.length) out.push({ ch: '⚑', color: 'yellow' });
  if (a.note) out.push({ ch: '✎', color: 'cyan' });
  if (a.remindAt) out.push({ ch: '◆', color: isReminderDue(a) ? 'red' : 'magenta' });
  return out;
}

function Row({ r, selected, wName, wBranch, wUsed, bar }: {
  r: SessionRecord; selected: boolean; wName: number; wBranch: number; wUsed: number; bar?: string;
}) {
  return (
    <Box>
      <Box width={2} flexShrink={0}><Text bold color={selected ? 'yellow' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
      <Box width={2} flexShrink={0}><Text color={STATUS_COLOR[r.status]} bold>{STATUS_DOT[r.status]}</Text></Box>
      <Box width={2} flexShrink={0}><Text bold color="yellow">{r.cwdDecodeConfident ? ' ' : '!'}</Text></Box>
      <Box width={wName} marginRight={1} flexShrink={0}>
        <Text bold={selected} color={selected ? 'cyan' : 'white'} wrap="truncate-end">{r.name}</Text>
      </Box>
      <Box width={4} flexShrink={0}>
        {badgeMarks(r).map((m, i) => <Text key={i} color={m.color}>{m.ch}</Text>)}
      </Box>
      <Box width={wBranch} marginRight={1} flexShrink={0}><Text color="magenta" wrap="truncate-end">{r.gitBranch ?? '–'}</Text></Box>
      <Box width={wUsed} marginRight={1} flexShrink={0}><Text color="cyan" wrap="truncate-end">{formatDate(r.lastUpdatedAt)}</Text></Box>
      <Box flexGrow={1} minWidth={0}><Text color="green" wrap="truncate-middle">{tildify(r.cwd)}</Text></Box>
      {bar ? <Box width={1} flexShrink={0}><Text dimColor>{bar}</Text></Box> : null}
    </Box>
  );
}

/** Always-visible "more info" for the highlighted row (Roy's ask): full metadata + last-used + recap. */
function DetailsPane({ s, recap, confirming }: { s: SessionRecord; recap?: RecapState; confirming: boolean }) {
  const recapLines = recap?.text ? recap.text.split('\n').filter((l) => l.trim()).slice(0, 6) : null;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box>
        <Text bold color="cyan">details  </Text>
        <Text bold color="white" wrap="truncate-end">{s.name}</Text>
      </Box>
      <Box>
        <Text color="magenta">{s.id}</Text>
        <Text dimColor>   </Text>
        <Text color={STATUS_COLOR[s.status]}>{STATUS_DOT[s.status]} {s.status}</Text>
        {s.gitBranch ? (<><Text dimColor>   ⎇ </Text><Text color="magenta">{s.gitBranch}</Text></>) : null}
        {!s.cwdDecodeConfident ? <Text color="yellow">   ⚠ cwd uncertain</Text> : null}
      </Box>
      <Box>
        <Text dimColor>started </Text><Text color="blue">{formatDate(s.startedAt)}</Text>
        <Text dimColor>   ·   last used </Text><Text color="cyan">{formatDate(s.lastUpdatedAt)}</Text>
        <Text dimColor> (</Text><Text color="yellow">{timeAgo(s.lastUpdatedAt)}</Text><Text dimColor> ago)</Text>
      </Box>
      <Box><Text color="green" wrap="truncate-middle">{tildify(s.cwd)}</Text></Box>
      {s.annotation ? (
        <Box>
          {s.annotation.done ? <Text color="green">✓ done   </Text> : null}
          {s.annotation.flags.map(f => <Text key={f} color="yellow">#{f} </Text>)}
          {s.annotation.remindAt ? (
            <Text color={isReminderDue(s.annotation) ? 'red' : 'magenta'}>
              {'  ◆ '}{isReminderDue(s.annotation) ? 'due ' : 'remind '}{formatDate(new Date(s.annotation.remindAt))}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {s.annotation?.note
        ? s.annotation.note.split('\n').slice(0, 3).map((l, i) => (
            <Text key={i} color="cyan" wrap="truncate-end">✎ {l}</Text>
          ))
        : null}
      <Box flexDirection="column">
        <Text bold color={recapLines ? 'green' : 'gray'}>recap</Text>
        {recap?.loading ? (
          <Text color="yellow">generating… (claude -p · haiku)</Text>
        ) : recap?.error ? (
          <Text color="red" wrap="truncate-end">{recap.error}</Text>
        ) : recapLines ? (
          recapLines.map((l, i) => <Text key={i} color="white" wrap="truncate-end">{l}</Text>)
        ) : (
          <Text dimColor>press R to generate a recap</Text>
        )}
      </Box>
      {confirming ? (
        <Box>
          <Text color="yellow">⚠ cwd uncertain — </Text>
          <Text bold color="yellow">Enter</Text>
          <Text color="yellow"> again to resume anyway, </Text>
          <Text bold color="yellow">esc</Text>
          <Text color="yellow"> to cancel</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function HelpRow({ k, v }: { k: string; v: string }) {
  return (
    <Box>
      <Box width={12}><Text color="cyan">{k}</Text></Box>
      <Text dimColor>{v}</Text>
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
