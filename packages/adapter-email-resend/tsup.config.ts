import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  shims: true,
  clean: true,
  target: 'node20',
  sourcemap: true,
  external: ['zod', '@openagentry/core'],
});
