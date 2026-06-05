import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { NewScreen } from '../../src/cli/screens/NewScreen.js';
import { AppShell } from '../../src/cli/screens/AppShell.js';
import { ConfigError } from '../../src/core/config/types.js';
import type { AgentCliMenuConfig } from '../../src/core/config/types.js';
import type { ProjectDir } from '../../src/core/groupScan.js';

const config: AgentCliMenuConfig = {
  groups: [
    { name: 'Frontend', path: '/code/fe', pathRaw: '~/code/fe', color: '#6C91BF' },
    { name: 'Backend', path: '/code/be', pathRaw: '~/code/be', color: '#A855F7' },
  ],
  tools: [{ name: 'cld', runs: 'claude --x', label: ' c ', color: '#6C91BF' }],
  ides: [{ key: 'ctrl-v', label: 'code', cmd: 'code "$dir"' }],
  defaultTool: 'cld',
  theme: { accent: '#FF9F43', border: '#6C91BF', pointer: '#FF9F43', statusBusy: 'green', statusIdle: 'yellow', statusInactive: 'gray' },
  gui: { terminal: 'Terminal' },
};
const dir = (name: string, group: string, color: string): ProjectDir =>
  ({ name, path: `/code/${group}/${name}`, group, groupColor: color, timeMs: 1700000000000, scoreSource: 'mtime' });

describe('AppShell', () => {
  it('starts in New with a New|Resume tab bar', () => {
    const projects = [[dir('web-app', 'fe', '#6C91BF')], [dir('api', 'be', '#A855F7')]];
    const { lastFrame } = render(
      <AppShell initialTab="new" config={config} warnings={[]} projects={projects} initialSessions={null} />
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('New');
    expect(f).toContain('Resume');   // inactive tab still labelled
    expect(f).toContain('switch');   // ⇥ switch hint
    expect(f).toContain('web-app');  // New content shown by default
  });
});

describe('NewScreen', () => {
  it('renders group sections, dir rows, and the tool', () => {
    const projects = [[dir('web-app', 'fe', '#6C91BF')], [dir('api', 'be', '#A855F7')]];
    const { lastFrame } = render(
      <NewScreen config={config} warnings={[]} projects={projects} />
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('Frontend');
    expect(f).toContain('Backend');
    expect(f).toContain('web-app');
    expect(f).toContain('api');
    expect(f).toContain('code'); // ide label in footer
  });

  it('shows the no-groups hint when empty', () => {
    const empty = { ...config, groups: [] };
    const { lastFrame } = render(<NewScreen config={empty} warnings={[]} projects={[]} />);
    expect(lastFrame() ?? '').toContain('no groups configured');
  });

  it('renders the config-error panel', () => {
    const { lastFrame } = render(
      <NewScreen warnings={[]} projects={[]} configError={new ConfigError(5, 'boom at line 3')} />
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('config error');
    expect(f).toContain('boom at line 3');
  });
});
