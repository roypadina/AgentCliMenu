import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ccsmHome, projectsDir, sessionsDir } from '../../src/core/paths.js';

describe('paths', () => {
  const original = process.env.CCSM_HOME;
  beforeEach(() => { delete process.env.CCSM_HOME; });
  afterEach(() => { if (original === undefined) delete process.env.CCSM_HOME; else process.env.CCSM_HOME = original; });

  it('defaults ccsmHome to ~/.claude', () => {
    expect(ccsmHome()).toBe(join(homedir(), '.claude'));
  });

  it('honors CCSM_HOME override', () => {
    process.env.CCSM_HOME = '/tmp/fake-home';
    expect(ccsmHome()).toBe('/tmp/fake-home');
    expect(projectsDir()).toBe('/tmp/fake-home/projects');
    expect(sessionsDir()).toBe('/tmp/fake-home/sessions');
  });
});
