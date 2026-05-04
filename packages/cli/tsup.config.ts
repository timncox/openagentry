import { defineConfig } from 'tsup';

export default defineConfig([
  // Bin: CJS for shebang reliability across npm/pnpm setups.
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    dts: false,
    clean: true,
    sourcemap: true,
    target: 'node20',
    shims: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  // Library: ESM + CJS + .d.ts for downstream consumers.
  {
    entry: { lib: 'src/lib.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,            // bin config above already cleaned dist/
    sourcemap: true,
    target: 'node20',
    shims: true,
  },
]);
