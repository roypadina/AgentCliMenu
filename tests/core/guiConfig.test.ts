import { describe, it, expect } from 'vitest';
import { buildContract, buildCmCommand, normalizeTerminal, subcommandForEntry } from '../../src/core/guiConfig.js';

describe('guiConfig', () => {
  it('maps entry → subcommand', () => {
    expect(subcommandForEntry('root')).toBe('');
    expect(subcommandForEntry('new')).toBe('new');
    expect(subcommandForEntry('resume')).toBe('resume');
  });

  it('normalizes terminal with a warning for unknowns', () => {
    expect(normalizeTerminal('iTerm')).toEqual({ terminal: 'iTerm' });
    expect(normalizeTerminal('Hyper').terminal).toBe('Terminal');
    expect(normalizeTerminal('Hyper').warning).toBeDefined();
  });

  it('builds an installed cm command (quotes spaced paths)', () => {
    expect(buildCmCommand('/opt/homebrew/bin/cm', 'new')).toBe('/opt/homebrew/bin/cm new');
    expect(buildCmCommand('/My Apps/cm', 'resume')).toBe(`'/My Apps/cm' resume`);
  });

  it('builds a dev (node) command', () => {
    expect(buildCmCommand('/repo/bin/cm', 'new', 'node')).toBe('node /repo/bin/cm new');
  });

  it('contract: custom terminal without template falls back to Terminal + warns', () => {
    const c = buildContract({ entry: 'new', cmPath: '/usr/local/bin/cm', terminalRaw: 'custom', configPath: '/c.toml' });
    expect(c.terminal).toBe('Terminal');
    expect(c.customTemplate).toBeNull();
    expect(c.warnings.length).toBeGreaterThan(0);
    expect(c.contractVersion).toBe(1);
  });

  it('contract: custom terminal with template is preserved', () => {
    const c = buildContract({
      entry: 'resume', cmPath: '/usr/local/bin/cm', terminalRaw: 'custom',
      customTemplate: 'open -a iTerm --args {{cmd}}', configPath: '/c.toml',
    });
    expect(c.terminal).toBe('custom');
    expect(c.customTemplate).toContain('{{cmd}}');
    expect(c.cmCommand).toBe('/usr/local/bin/cm resume');
  });
});
