import { describe, it, expect } from 'vitest';
import { planTerminal, resolveCustomTemplate } from '../../src/core/terminalLaunch.js';

describe('planTerminal', () => {
  it('default → open the temp script in the system default terminal', () => {
    const p = planTerminal({ terminal: 'default', command: 'claude --x', cwd: '/a/app' });
    expect(p.mode).toBe('default');
    expect(p.scriptBody).toContain("cd '/a/app'");
    expect(p.scriptBody).toContain('exec claude --x');
  });

  it('empty terminal falls back to default', () => {
    expect(planTerminal({ terminal: '', command: 'x', cwd: '/c' }).mode).toBe('default');
  });

  it('app name → open -a that app', () => {
    const p = planTerminal({ terminal: 'iTerm', command: 'x', cwd: '/c' });
    expect(p.mode).toBe('app');
    expect(p.appName).toBe('iTerm');
  });

  it('custom → carries the template', () => {
    const p = planTerminal({ terminal: 'custom', customTemplate: 'open -a Foo {{script}}', command: 'x', cwd: '/c' });
    expect(p.mode).toBe('custom');
    expect(p.customTemplate).toContain('{{script}}');
  });

  it('shell-quotes a cwd with spaces/quotes', () => {
    const p = planTerminal({ terminal: 'default', command: 'x', cwd: "/a b/it's" });
    expect(p.scriptBody).toContain("cd '/a b/it'\\''s'");
  });
});

describe('resolveCustomTemplate', () => {
  it('replaces all placeholders', () => {
    expect(resolveCustomTemplate('open -a X {{script}} # {{cmd}} @ {{dir}}', { script: '/s.command', cmd: 'cd /d && run', dir: '/d' }))
      .toBe('open -a X /s.command # cd /d && run @ /d');
  });
});
