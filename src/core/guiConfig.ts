// Pure helpers for the Mac GUI contract. No fs / no argv here (see cli/guiConfigCmd.ts).

export type GuiEntry = 'root' | 'new' | 'resume';

export interface GuiContract {
  contractVersion: 1;
  /** "Terminal" | "iTerm" | "custom" */
  terminal: string;
  /** the cm executable the GUI should invoke (informational). */
  cmBin: string;
  /** full runnable shell command for the chosen entry (already path-quoted). */
  cmCommand: string;
  /** path to the user's config (for the "Open config" menu item). */
  configPath: string;
  /** for terminal = "custom": shell template with {{cmd}} = cmCommand. */
  customTemplate: string | null;
  entry: GuiEntry;
  warnings: string[];
}

export function subcommandForEntry(e: GuiEntry): string {
  return e === 'resume' ? 'resume' : e === 'new' ? 'new' : '';
}

const ALLOWED_TERMINALS = ['Terminal', 'iTerm', 'custom'];

export function normalizeTerminal(raw: string): { terminal: string; warning?: string } {
  if (ALLOWED_TERMINALS.includes(raw)) return { terminal: raw };
  return { terminal: 'Terminal', warning: `unknown terminal "${raw}" → Terminal` };
}

/** Quote a path for inlining into a shell command. */
function q(p: string): string {
  return /[^A-Za-z0-9_./-]/.test(p) ? `'${p.replace(/'/g, `'\\''`)}'` : p;
}

/** Build the runnable shell command. `runner` is '' for an installed cm, or 'node' for dev. */
export function buildCmCommand(cmPath: string, entry: GuiEntry, runner = ''): string {
  const sub = subcommandForEntry(entry);
  const base = runner ? `${runner} ${q(cmPath)}` : q(cmPath);
  return sub ? `${base} ${sub}` : base;
}

export function buildContract(opts: {
  entry: GuiEntry;
  cmPath: string;
  runner?: string;
  terminalRaw: string;
  customTemplate?: string;
  configPath: string;
}): GuiContract {
  const { terminal, warning } = normalizeTerminal(opts.terminalRaw);
  const warnings: string[] = [];
  if (warning) warnings.push(warning);
  if (terminal === 'custom' && !opts.customTemplate) {
    warnings.push('terminal = "custom" but no launch_command set → falling back to Terminal');
  }
  const effectiveTerminal = terminal === 'custom' && !opts.customTemplate ? 'Terminal' : terminal;
  return {
    contractVersion: 1,
    terminal: effectiveTerminal,
    cmBin: opts.runner ? `${opts.runner} ${opts.cmPath}` : opts.cmPath,
    cmCommand: buildCmCommand(opts.cmPath, opts.entry, opts.runner),
    configPath: opts.configPath,
    customTemplate: effectiveTerminal === 'custom' ? (opts.customTemplate ?? null) : null,
    entry: opts.entry,
    warnings,
  };
}
