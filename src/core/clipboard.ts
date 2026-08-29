import { spawnSync } from 'node:child_process';

/** Clipboard writers, in the order they are worth trying on each platform. */
const WRITERS: Array<[string, string[]]> =
  process.platform === 'darwin'
    ? [['pbcopy', []]]
    : process.platform === 'win32'
      ? [['clip', []]]
      : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];

/**
 * Put `text` on the system clipboard. Returns false when no clipboard tool is available —
 * callers should say so rather than pretending the copy worked.
 */
export function copyToClipboard(text: string): boolean {
  for (const [cmd, args] of WRITERS) {
    const r = spawnSync(cmd, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

/**
 * The command to paste into another terminal to pick this session back up. `agentctl resume`
 * handles the working directory and pins the right Claude profile, which a bare
 * `claude --resume` would not.
 */
export function resumeCommand(id: string): string {
  return `agentctl resume ${id}`;
}
