import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '@openagentry/adapter-test-suite';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '../..');

const envReady = typeof process.env['NEON_API_KEY'] === 'string' && process.env['NEON_API_KEY'].length > 0;

describe.skipIf(!envReady)('integration: db conformance against live Neon', () => {
  it(
    'passes universal + db functional suites',
    async () => {
      const result = await runSuite({ target: packageDir });
      const failed = result.checks.filter((c) => c.status === 'fail');
      if (failed.length > 0) {
        console.error(JSON.stringify(failed, null, 2));
      }
      expect(result.failed).toBe(0);
      // 4 universal + 5 db functional = 9 checks expected.
      expect(result.passed + result.skipped).toBeGreaterThanOrEqual(9);
    },
    180_000,
  );
});

describe.skipIf(envReady)('integration: skipped without NEON_API_KEY', () => {
  it('this suite needs NEON_API_KEY set', () => {
    expect(true).toBe(true);
  });
});
