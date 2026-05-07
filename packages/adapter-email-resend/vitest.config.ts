import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    typecheck: { tsconfig: './tsconfig.test.json' },
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    hookTimeout: 90_000,
  },
});
