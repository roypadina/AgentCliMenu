import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { NewScreen } from './NewScreen.js';
import { App as ResumeApp } from '../tui.js';
import { setScreenResult } from '../router.js';
import { listSessions } from '../../core/sessionRepo.js';
import type { ClaudeMenuConfig, ConfigError, ConfigWarning } from '../../core/config/types.js';
import type { ProjectDir } from '../../core/groupScan.js';
import type { SessionRecord } from '../../core/types.js';

export type Tab = 'new' | 'resume';

interface AppShellProps {
  initialTab: Tab;
  config?: ClaudeMenuConfig;
  warnings: ConfigWarning[];
  projects: ProjectDir[][];
  configError?: ConfigError;
  initialSessions: SessionRecord[] | null;
}

function TabBar({ tab }: { tab: Tab }) {
  const item = (label: string, active: boolean) =>
    active
      ? <Text bold color="#FF9F43">[ {label} ]</Text>
      : <Text dimColor>  {label}  </Text>;
  return (
    <Box marginBottom={1}>
      {item('New', tab === 'new')}
      <Text dimColor>│</Text>
      {item('Resume', tab === 'resume')}
      <Text dimColor>     ⇥ switch{tab === 'new' ? '   ⇧⇥ tool' : ''}</Text>
    </Box>
  );
}

/** Single mount holding both screens; ⇥ flips the tab (instant, no remount). */
export function AppShell({ initialTab, config, warnings, projects, configError, initialSessions }: AppShellProps) {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sessions, setSessions] = useState<SessionRecord[] | null>(initialSessions);
  const startedResume = useRef(false);

  // Persistent input subscription: keeps ink's stdin engaged across screen swaps
  // (without it, the brief "loading sessions…" frame has no useInput and ink exits).
  // Only handles Ctrl-C; child screens handle everything else.
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { setScreenResult({ kind: 'quit' }); exit(); }
  });

  // Lazy-load sessions the first time Resume is shown. Guard with a ref (not a state
  // flag) so re-renders don't cancel the in-flight load.
  useEffect(() => {
    if (tab === 'resume' && sessions === null && !startedResume.current) {
      startedResume.current = true;
      listSessions().then(setSessions).catch(() => setSessions([]));
    }
  }, [tab, sessions]);

  return (
    <Box flexDirection="column">
      <TabBar tab={tab} />
      {tab === 'new' ? (
        <NewScreen
          config={config}
          warnings={warnings}
          projects={projects}
          configError={configError}
          onSwitchTab={() => setTab('resume')}
        />
      ) : sessions === null ? (
        <Text dimColor>loading sessions…</Text>
      ) : (
        <ResumeApp
          initial={sessions}
          onSwitchTab={() => setTab('new')}
          onResume={(s) => setScreenResult({ kind: 'resume', record: s })}
          onBack={() => setTab('new')}
          onQuit={() => setScreenResult({ kind: 'quit' })}
        />
      )}
    </Box>
  );
}
