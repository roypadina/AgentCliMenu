import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { claudeHomes } from './paths.js';

/** The Claude home used when CLAUDE_CONFIG_DIR is unset. */
export function primaryHome(): string {
  return join(homedir(), '.claude');
}

export function isPrimaryHome(home: string): boolean {
  return resolve(home) === resolve(primaryHome());
}

/**
 * Where a profile's `.claude.json` lives. The DEFAULT profile keeps it at `~/.claude.json` —
 * beside the directory, not inside it. A side profile (`CLAUDE_CONFIG_DIR=~/.claudeN`) keeps it
 * at `~/.claudeN/.claude.json`. Getting this backwards makes `~/.claude/.claude.json` look like
 * the primary's config when it is really an unused stub with no account on it.
 */
export function profileConfigPath(home: string): string {
  return isPrimaryHome(home) ? join(homedir(), '.claude.json') : join(home, '.claude.json');
}

/** The account a profile is logged in as, or null when it has none. */
export function profileAccount(home: string): string | null {
  try {
    const d = JSON.parse(readFileSync(profileConfigPath(home), 'utf8')) as Record<string, unknown>;
    const acc = d.oauthAccount as { emailAddress?: string } | undefined;
    return acc?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export interface Profile {
  /** The Claude home, e.g. `~/.claude` or `~/.claude3`. */
  home: string;
  /** Account it is logged in as. */
  account: string;
  isPrimary: boolean;
}

/**
 * Every Claude profile on this machine that is actually logged in, primary first.
 *
 * Which profile a DEAD session belongs to is not recorded anywhere — when profiles share a
 * `projects/` dir (the usual CLAUDE_CONFIG_DIR setup symlinks it) that information does not exist
 * on disk. Hence the override: the user picks.
 */
export function listProfiles(): Profile[] {
  const out: Profile[] = [];
  for (const home of claudeHomes()) {
    const account = profileAccount(home);
    if (account) out.push({ home, account, isPrimary: isPrimaryHome(home) });
  }
  return out;
}

/** Resolve a user-supplied profile: an account email, a home path, or a directory name. */
export function resolveProfile(input: string): Profile | null {
  const profiles = listProfiles();
  const needle = input.trim().toLowerCase();
  return (
    profiles.find(p => p.account.toLowerCase() === needle) ??
    profiles.find(p => resolve(p.home) === resolve(input)) ??
    profiles.find(p => basename(p.home).replace(/^\./, '').toLowerCase() === needle.replace(/^\./, '')) ??
    profiles.find(p => p.account.toLowerCase().startsWith(needle)) ??
    null
  );
}
