import { existsSync } from 'node:fs';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import type { SessionRecord } from '../core/types.js';

export class ResumeError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ResumeError';
  }
}

export interface ResumeOptions {
  yes?: boolean;
  cwdOverride?: string;
}

export interface ResumeDeps {
  exists?: (p: string) => boolean;
  spawn?: (
    cmd: string,
    args: string[],
    opts: { cwd: string; stdio: 'inherit'; env: NodeJS.ProcessEnv },
  ) => SpawnSyncReturns<Buffer>;
  exit?: (code: number) => never;
}

export function resume(
  s: SessionRecord,
  opts: ResumeOptions = {},
  deps: ResumeDeps = {},
): void {
  const exists = deps.exists ?? existsSync;
  const spawn = deps.spawn ?? (spawnSync as unknown as NonNullable<ResumeDeps['spawn']>);
  const exit = deps.exit ?? ((code: number) => { process.exit(code); }) as (code: number) => never;

  const targetCwd = opts.cwdOverride ?? s.cwd;
  if (!targetCwd || !exists(targetCwd)) {
    throw new ResumeError(3, `session cwd missing: ${targetCwd ?? '(unknown)'}`);
  }
  if (s.active && s.status === 'busy' && !opts.yes) {
    throw new ResumeError(4, `session ${s.id.slice(0, 8)} is busy; pass --yes to resume anyway`);
  }
  const bin = process.env.CCSM_CLAUDE_BIN ?? 'claude';
  const child = spawn(
    bin,
    ['--resume', s.id, '--dangerously-skip-permissions'],
    { cwd: targetCwd, stdio: 'inherit', env: process.env },
  );
  const err = child.error as NodeJS.ErrnoException | undefined;
  if (err && err.code === 'ENOENT') {
    throw new ResumeError(127, `claude not found on PATH (override via CCSM_CLAUDE_BIN)`);
  }
  exit(child.status ?? 1);
}
