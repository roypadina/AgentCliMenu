import React, { useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { setScreenResult, type ScreenResult } from '../router.js';
import { executePlan } from '../launch.js';
import { hexColor } from '../theme.js';
import { timeAgo } from '../format.js';
import {
  planLaunch, planNewDir, resolveNewDir, defaultNewDirChoice,
  type LaunchPlan,
} from '../../core/launchSpec.js';
import { getTool } from '../../core/config/loadConfig.js';
import { fuzzyMatch } from '../../core/fuzzy.js';
import type { AgentCliMenuConfig, ConfigError, ConfigWarning } from '../../core/config/types.js';
import type { ProjectDir } from '../../core/groupScan.js';

interface NewScreenProps {
  config?: AgentCliMenuConfig;
  warnings: ConfigWarning[];
  projects: ProjectDir[][];
  configError?: ConfigError;
  /** ⇥ switches to the Resume tab (handled by AppShell). */
  onSwitchTab?: () => void;
}

type Row = { kind: 'header'; name: string; color: string } | { kind: 'dir'; dir: ProjectDir };
type Mode = 'list' | 'nd-base' | 'nd-name' | 'help';

export function NewScreen({ config, warnings, projects, configError, onSwitchTab }: NewScreenProps) {
  const { exit } = useApp();
  const finish = (r: ScreenResult) => { setScreenResult(r); exit(); };
  const insideTmux = !!process.env.TMUX;

  const tools = config?.tools ?? [];
  const [toolIdx, setToolIdx] = useState(() => {
    const i = tools.findIndex((t) => t.name === (config?.defaultTool ?? 'cld'));
    return i >= 0 ? i : 0;
  });
  const tool = tools[toolIdx] ?? (config ? getTool(config, config.defaultTool) : { name: 'cld', runs: 'claude --dangerously-skip-permissions', label: '', color: '#6C91BF' });

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [ndName, setNdName] = useState('');
  const [ndChoice, setNdChoice] = useState<number | 'full' | 'under'>('full');

  const groups = config?.groups ?? [];

  // Build rows + selectable dir list — fuzzy-ranked within each group when filtering.
  const { rows, dirs } = useMemo(() => {
    const q = query.trim();
    const rows: Row[] = [];
    const dirs: ProjectDir[] = [];
    groups.forEach((g, gi) => {
      let groupDirs = projects[gi] ?? [];
      if (q) {
        groupDirs = groupDirs
          .map((d) => ({ d, m: fuzzyMatch(q, d.name) ?? fuzzyMatch(q, d.path) }))
          .filter((x) => x.m)
          .sort((a, b) => b.m!.score - a.m!.score)
          .map((x) => x.d);
      }
      if (groupDirs.length === 0) return;
      rows.push({ kind: 'header', name: g.name, color: g.color });
      for (const d of groupDirs) { rows.push({ kind: 'dir', dir: d }); dirs.push(d); }
    });
    return { rows, dirs };
  }, [groups, projects, query]);

  const clamped = Math.min(cursor, Math.max(0, dirs.length - 1));
  const selected = dirs[clamped];

  // Viewport: window the header+dir rows around the selection so long lists don't overflow.
  const termRows = process.stdout.rows ?? 30;
  const maxVisible = Math.max(4, termRows - 9); // header + warnings + nd/footer + affordances
  const selRowIdx = selected ? rows.findIndex((r) => r.kind === 'dir' && r.dir === selected) : 0;
  const winStart = rows.length <= maxVisible
    ? 0
    : Math.max(0, Math.min(rows.length - maxVisible, selRowIdx - Math.floor(maxVisible / 2)));
  const winEnd = Math.min(rows.length, winStart + maxVisible);
  const view = rows.slice(winStart, winEnd);
  // If the window opens mid-group, show the owning header once for context (not a sticky header).
  const ctxHeader = view[0]?.kind === 'dir'
    ? (() => { for (let i = winStart - 1; i >= 0; i--) { const r = rows[i]; if (r.kind === 'header') return r; } return null; })()
    : null;
  const hiddenAbove = rows.slice(0, winStart).filter((r) => r.kind === 'dir').length;
  const hiddenBelow = rows.slice(winEnd).filter((r) => r.kind === 'dir').length;

  const dispatch = (plan: LaunchPlan) => {
    if (plan.returnsToTui) { executePlan(plan); return; } // finder etc — stay in TUI
    finish({ kind: 'launch', plan });
  };

  // ---- config error / empty states ----
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { finish({ kind: 'quit' }); return; }

    if (configError) {
      if (key.tab) { onSwitchTab?.(); return; }
      if (key.escape) finish({ kind: 'quit' });
      return;
    }

    if (mode === 'help') { setMode('list'); return; } // any key closes

    if (mode === 'nd-name') {
      if (key.escape) { setMode('list'); setNdName(''); }
      return; // TextInput owns the rest
    }

    if (mode === 'nd-base') {
      if (key.escape) { setMode('list'); return; }
      const def = defaultNewDirChoice(selected?.path, groups);
      let choice: number | 'full' | 'under' | null = null;
      if (key.return) choice = def === 'full' ? 'full' : def;
      else if (input === '.') choice = 'under';
      else if (input === '/') choice = 'full';
      else if (/^[1-9]$/.test(input)) { const n = Number(input); if (n <= groups.length) choice = n; }
      if (choice === null) return;
      setNdChoice(choice);
      setNdName('');
      setMode('nd-name');
      return;
    }

    // list mode
    if (key.escape) { if (query) setQuery(''); else finish({ kind: 'quit' }); return; }
    if (input === '?') { setMode('help'); return; }
    if (key.tab && key.shift) { if (tools.length) setToolIdx((i) => (i + 1) % tools.length); return; }
    if (key.tab) { onSwitchTab?.(); return; }
    if (key.upArrow) { setCursor((c) => Math.max(0, c - 1)); return; }
    if (key.downArrow) { setCursor((c) => Math.min(dirs.length - 1, c + 1)); return; }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); return; }

    const k = key.ctrl && input ? 'ctrl-' + input.toLowerCase() : '';
    if (k === 'ctrl-n') { setMode('nd-base'); return; }
    if (!selected && k !== 'ctrl-n') {
      // no dir selected: only new-dir is meaningful; ignore other actions
      if (!k && input && !key.ctrl && input >= ' ') setQuery((q) => q + input);
      return;
    }
    if (selected) {
      const ide = config?.ides.find((i) => i.key === k);
      if (ide) { dispatch(planLaunch({ dir: selected.path, key: k, tool, ide, insideTmux })); return; }
      if (k === 'ctrl-f' || k === 'ctrl-p' || k === 'ctrl-t') {
        dispatch(planLaunch({ dir: selected.path, key: k, tool, insideTmux })); return;
      }
      if (key.return) { dispatch(planLaunch({ dir: selected.path, key: '', tool, insideTmux })); return; }
    }
    if (!key.ctrl && input && input >= ' ' && input.length === 1) setQuery((q) => q + input);
  });

  const submitNewDir = (raw: string) => {
    const name = raw.trim();
    if (!name) { setMode('list'); return; }
    const mode2 = ndChoice === 'full' ? 'full' : ndChoice === 'under' ? 'under' : 'group';
    const { path } = resolveNewDir(
      { mode: mode2, name, index: typeof ndChoice === 'number' ? ndChoice : undefined, highlightedDir: selected?.path, cwd: process.cwd() },
      groups,
    );
    finish({ kind: 'launch', plan: planNewDir(path, tool) });
  };

  // ---- render ----
  if (configError) {
    return (
      <Box flexDirection="column">
        <Text bold color="red">config error</Text>
        <Box marginTop={1}><Text>{configError.message}</Text></Box>
        <Box marginTop={1}><Text dimColor>Fix it (cm config --edit), then reopen.  esc back</Text></Box>
      </Box>
    );
  }

  const ndBasePrompt = () => {
    const def = defaultNewDirChoice(selected?.path, groups);
    const parts = groups.map((g, i) => `[${i + 1}]${g.name}`);
    parts.push('[.]under highlighted', '[/]full path');
    return `new dir → ${parts.join('  ')}  (${def === 'full' ? '/' : def})`;
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={hexColor(tool.color)}>  {tool.name} ›</Text>
        <Text dimColor>  tool </Text><Text color="cyan">{tool.name}</Text>
        {tools.length > 1 ? <Text dimColor> (⇧⇥)</Text> : null}
        {query ? (<><Text dimColor>   /</Text><Text color="yellow">{query}</Text><Text dimColor>  ({dirs.length})</Text></>) : null}
      </Box>

      {warnings.length > 0 ? (
        <Box><Text color="yellow">⚠ {warnings.length} config warning{warnings.length > 1 ? 's' : ''}</Text></Box>
      ) : null}

      {mode === 'help' ? <HelpOverlay ides={config?.ides ?? []} toolName={tool.name} /> : (
        <Box flexDirection="column" marginTop={1}>
          {rows.length === 0 ? (
            <Text dimColor>
              {groups.length === 0
                ? '(no groups configured — run: cm config --setup, then add [[group]] entries)'
                : query ? `(no matches for "${query}")` : '(no matching project dirs)'}
            </Text>
          ) : (
            <>
              {ctxHeader ? <Text bold color={hexColor(ctxHeader.color)}>── {ctxHeader.name} ──────────────────</Text> : null}
              {hiddenAbove > 0 ? <Text dimColor>  ▲ {hiddenAbove} more above</Text> : null}
              {view.map((row, i) => {
                if (row.kind === 'header') {
                  return <Text key={'h' + (winStart + i)} bold color={hexColor(row.color)}>── {row.name} ──────────────────</Text>;
                }
                const d = row.dir;
                const sel = d === selected;
                return (
                  <Box key={d.path}>
                    <Text bold color={sel ? 'yellow' : 'gray'}>{sel ? '▸ ' : '  '}</Text>
                    <Text bold color={sel ? 'cyan' : 'white'}>{d.name}</Text>
                    <Text dimColor>   {timeAgo(new Date(d.timeMs))}</Text>
                    {d.gitBranch ? (<><Text dimColor>   ⎇ </Text><Text color="magenta">{d.gitBranch}</Text></>) : null}
                  </Box>
                );
              })}
              {hiddenBelow > 0 ? <Text dimColor>  ▼ {hiddenBelow} more below</Text> : null}
            </>
          )}
        </Box>
      )}

      {mode === 'nd-base' ? (
        <Box marginTop={1}><Text color="yellow">{ndBasePrompt()}</Text></Box>
      ) : null}
      {mode === 'nd-name' ? (
        <Box marginTop={1}>
          <Text color="yellow">{ndChoice === 'full' ? 'full path: ' : 'new dir name: '}</Text>
          <TextInput value={ndName} onChange={setNdName} onSubmit={submitNewDir} />
        </Box>
      ) : null}

      {mode === 'list' ? (
        <Box marginTop={1}>
          <Text dimColor>↑/↓ </Text><Text color="white">move</Text>
          <Text dimColor>  ·  ↵ </Text><Text color="white">{tool.name}</Text>
          <Text dimColor>  ·  ^n </Text><Text color="white">new</Text>
          <Text dimColor>  ·  type to filter  ·  </Text><Text color="white">?</Text><Text dimColor> keys  ·  esc back</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function HelpOverlay({ ides, toolName }: { ides: Array<{ key: string; label: string }>; toolName: string }) {
  const Row = ({ k, v }: { k: string; v: string }) => (
    <Box>
      <Box width={14}><Text color="cyan">{k}</Text></Box>
      <Text dimColor>{v}</Text>
    </Box>
  );
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">keys — New</Text>
      <Row k="↑ / ↓" v="move selection" />
      <Row k="type" v="fuzzy-filter the dirs" />
      <Row k="enter" v={`launch ${toolName} in the selected dir`} />
      <Row k="⇥ tab" v="switch to Resume" />
      <Row k="⇧⇥" v="cycle tool" />
      <Row k="^n" v="new directory" />
      <Row k="^t" v="open in tmux" />
      <Row k="^p" v="git pull first" />
      <Row k="^f" v="reveal in Finder" />
      {ides.map((i) => <Row key={i.key} k={`^${i.key.replace('ctrl-', '')}`} v={`open in ${i.label}`} />)}
      <Row k="esc" v="clear filter / quit" />
      <Box marginTop={1}><Text dimColor>press any key to close</Text></Box>
    </Box>
  );
}
