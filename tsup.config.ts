import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Single source of truth for the CLI version: package.json, injected at build time so `--version`
// can never drift from a hardcoded literal. Source runs (tsx, no define) fall back to 'dev'.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  target: 'node18',
  clean: true,
  sourcemap: true,
  define: { __ACM_VERSION__: JSON.stringify(version) },
});
