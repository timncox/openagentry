import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '@openagentry/adapter-test-suite';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '../..');

describe('integration: auth conformance against the local package default', () => {
  it(
    'passes universal + auth functional suites',
    async () => {
      const result = await runSuite({ target: packageDir });
      const failed = result.checks.filter((c) => c.status === 'fail');
      if (failed.length > 0) {
        console.error(JSON.stringify(failed, null, 2));
      }
      expect(result.failed).toBe(0);
      // 4 universal + 5 auth functional = 9 checks expected.
      expect(result.passed + result.skipped).toBeGreaterThanOrEqual(9);
    },
    30_000,
  );
});
