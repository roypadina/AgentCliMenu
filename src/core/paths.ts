import { homedir } from 'node:os';
import { join } from 'node:path';

export function ccsmHome(): string {
  return process.env.CCSM_HOME ?? join(homedir(), '.claude');
}

export function projectsDir(): string {
  return join(ccsmHome(), 'projects');
}

export function sessionsDir(): string {
  return join(ccsmHome(), 'sessions');
}
