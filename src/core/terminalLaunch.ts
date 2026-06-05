// Pure planner for opening a command in a terminal. No fs/spawn here (see cli/openSession.ts).
// The GUI launches sessions in the user's configured terminal; default = the system default
// terminal (whatever owns `.command` files).

export type TerminalMode = 'default' | 'app' | 'custom';

export interface TerminalPlan {
  /** contents of a temp *.command script: cd + exec the command. */
  scriptBody: string;
  mode: TerminalMode;
  /** for mode 'app': the application name to `open -a`. */
  appName?: string;
  /** for mode 'custom': the user template, with {{script}} / {{cmd}} / {{dir}} placeholders. */
  customTemplate?: string;
}

function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Build a launch plan.
 *  - terminal "default" (or empty) → open the temp script in the system default terminal.
 *  - terminal "custom"             → run the user's launch_command template.
 *  - any other value               → treat as an application name (`open -a <name>`).
 */
export function planTerminal(opts: {
  terminal: string;
  customTemplate?: string;
  /** shell command line to run (e.g. "claude --dangerously-skip-permissions"). */
  command: string;
  cwd: string;
}): TerminalPlan {
  const { terminal, customTemplate, command, cwd } = opts;
  const scriptBody = `#!/bin/sh\ncd ${shq(cwd)} || exit 1\nexec ${command}\n`;

  const t = (terminal || 'default').trim();
  if (t === 'default') return { scriptBody, mode: 'default' };
  if (t === 'custom') return { scriptBody, mode: 'custom', customTemplate: customTemplate ?? '' };
  return { scriptBody, mode: 'app', appName: t };
}

/** Resolve a custom template's placeholders. Used by the executor (cli) and unit-tested here. */
export function resolveCustomTemplate(template: string, vars: { script: string; cmd: string; dir: string }): string {
  return template
    .replace(/\{\{\s*script\s*\}\}/g, vars.script)
    .replace(/\{\{\s*cmd\s*\}\}/g, vars.cmd)
    .replace(/\{\{\s*dir\s*\}\}/g, vars.dir);
}
