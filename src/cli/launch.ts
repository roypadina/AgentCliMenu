import { spawnSync, spawn as spawnAsync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import type { LaunchPlan, LaunchStep } from '../core/launchSpec.js';

export class LaunchError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'LaunchError';
  }
}

const SHELL = process.env.SHELL ?? '/bin/zsh';

/** POSIX single-quote a value for safe inlining as `dir=<quoted>`. */
export function shellQuote(s: string): string {
  return `'` + s.replace(/'/g, `'\\''`) + `'`;
}

export interface LaunchDeps {
  spawnSync?: typeof spawnSync;
  spawn?: typeof spawnAsync;
  mkdir?: (p: string) => void;
  exists?: (p: string) => boolean;
  exit?: (code: number) => never;
}

/** Wrap a step's command so $dir (lowercase) is set + shell-quoted, then run via SHELL -c (NOT -lc). */
function wrap(step: LaunchStep): string {
  return `dir=${shellQuote(step.cwd)}; ${step.command}`;
}

export function hasCommand(name: string): boolean {
  const r = spawnSync(SHELL, ['-c', `command -v ${name}`], { stdio: 'ignore' });
  return r.status === 0;
}

/**
 * Execute a launch plan. Detached steps (IDE/finder) are fire-and-forget; the final interactive
 * step inherits stdio and, when present, drives the exit code. MUST be called AFTER ink teardown
 * (see router.runScreen) for any plan with requiresTeardown — never inside a useInput callback.
 */
export function executePlan(plan: LaunchPlan, deps: LaunchDeps = {}): number {
  const spawnSyncFn = deps.spawnSync ?? spawnSync;
  const spawnFn = deps.spawn ?? spawnAsync;
  const mkdir = deps.mkdir ?? ((p: string) => { mkdirSync(p, { recursive: true }); });
  const exists = deps.exists ?? existsSync;

  if (plan.mkdir) {
    try {
      mkdir(plan.mkdir);
    } catch (e) {
      throw new LaunchError(5, `failed to create ${plan.mkdir}: ${(e as Error).message}`);
    }
  }

  let lastStatus = 0;
  let sawInteractive = false;
  for (const step of plan.steps) {
    if (!step.detached && !exists(step.cwd)) {
      throw new LaunchError(3, `directory missing: ${step.cwd}`);
    }
    if (step.detached) {
      const child = spawnFn(SHELL, ['-c', wrap(step)], {
        cwd: step.cwd, stdio: 'ignore', detached: true, env: process.env,
      });
      child.unref?.();
      continue;
    }
    sawInteractive = sawInteractive || step.stdio === 'inherit';
    const r = spawnSyncFn(SHELL, ['-c', wrap(step)], {
      cwd: step.cwd, stdio: step.stdio, env: process.env,
    });
    const err = r.error as NodeJS.ErrnoException | undefined;
    if (err && err.code === 'ENOENT') {
      throw new LaunchError(127, `${SHELL} not found`);
    }
    lastStatus = r.status ?? 0;
  }
  return sawInteractive ? lastStatus : 0;
}
