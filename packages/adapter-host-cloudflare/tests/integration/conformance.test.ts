import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '@openagentry/adapter-test-suite';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '../..');

const envReady =
  typeof process.env['CLOUDFLARE_API_TOKEN'] === 'string' &&
  typeof process.env['CLOUDFLARE_ACCOUNT_ID'] === 'string';

describe.skipIf(!envReady)('integration: host conformance against live Cloudflare', () => {
  it(
    'passes universal + host functional suites',
    async () => {
      const result = await runSuite({ target: packageDir });
      const failed = result.checks.filter((c) => c.status === 'fail');
      if (failed.length > 0) {
        // Surface which checks failed — useful CI signal when run locally.
        console.error(JSON.stringify(failed, null, 2));
      }
      expect(result.failed).toBe(0);
      // 4 universal + 5 host functional = 9 checks expected.
      expect(result.passed + result.skipped).toBeGreaterThanOrEqual(9);
    },
    120_000,
  );
});

describe.skipIf(envReady)('integration: skipped without CLOUDFLARE_* env', () => {
  it('this suite needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID set', () => {
    expect(true).toBe(true);
  });
});
