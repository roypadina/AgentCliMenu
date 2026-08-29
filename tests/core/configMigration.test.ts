import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let base: string;
let origXdg: string | undefined;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'agentctl-migrate-'));
  origXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = base;
  vi.resetModules(); // the migration runs once per module load
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = origXdg;
});

describe('0.5.0 rename migration', () => {
  it('moves a pre-rename agentclimenu dir over, annotations and recaps included', async () => {
    const legacy = join(base, 'agentclimenu');
    mkdirSync(join(legacy, 'annotations'), { recursive: true });
    mkdirSync(join(legacy, 'recaps'), { recursive: true });
    writeFileSync(join(legacy, 'config.toml'), 'defaultTool = "cld"\n');
    writeFileSync(join(legacy, 'annotations', 'x.json'), '{"sessionId":"x","flags":[],"labels":[],"done":true}');

    const { configDir } = await import('../../src/core/config/paths.js');
    const dir = configDir();

    expect(dir).toBe(join(base, 'agentctl'));
    expect(readFileSync(join(dir, 'config.toml'), 'utf8')).toContain('defaultTool');
    expect(existsSync(join(dir, 'annotations', 'x.json'))).toBe(true);
    expect(existsSync(join(dir, 'recaps'))).toBe(true);
    expect(existsSync(legacy)).toBe(false);
  });

  it('leaves an existing agentctl dir alone', async () => {
    mkdirSync(join(base, 'agentctl'), { recursive: true });
    writeFileSync(join(base, 'agentctl', 'config.toml'), 'new\n');
    mkdirSync(join(base, 'agentclimenu'), { recursive: true });
    writeFileSync(join(base, 'agentclimenu', 'config.toml'), 'old\n');

    const { configDir } = await import('../../src/core/config/paths.js');
    expect(readFileSync(join(configDir(), 'config.toml'), 'utf8').trim()).toBe('new');
    expect(existsSync(join(base, 'agentclimenu'))).toBe(true);   // untouched
  });

  it('is a no-op when there is nothing to migrate', async () => {
    const { configDir } = await import('../../src/core/config/paths.js');
    expect(configDir()).toBe(join(base, 'agentctl'));
    expect(existsSync(join(base, 'agentctl'))).toBe(false);      // created lazily by writers
  });
});
