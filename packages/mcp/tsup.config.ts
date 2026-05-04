import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node20',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
