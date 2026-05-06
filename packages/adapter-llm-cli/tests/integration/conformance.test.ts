import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '@openagentry/adapter-test-suite';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '../..');
const stubClaude = resolve(packageDir, 'tests/fixtures/stub-claude.js');

describe('integration: llm conformance against the local package default', () => {
  const previousCli = process.env['OA_LLM_CLI'];
  const previousBin = process.env['OA_LLM_CLI_BIN'];

  beforeAll(() => {
    process.env['OA_LLM_CLI'] = 'claude';
    process.env['OA_LLM_CLI_BIN'] = stubClaude;
  });

  afterAll(() => {
    if (previousCli === undefined) delete process.env['OA_LLM_CLI'];
    else process.env['OA_LLM_CLI'] = previousCli;
    if (previousBin === undefined) delete process.env['OA_LLM_CLI_BIN'];
    else process.env['OA_LLM_CLI_BIN'] = previousBin;
  });

  it(
    'passes universal + llm functional suites',
    async () => {
      const result = await runSuite({ target: packageDir });
      const failed = result.checks.filter((c) => c.status === 'fail');
      if (failed.length > 0) {
        console.error(JSON.stringify(failed, null, 2));
      }
      expect(result.failed).toBe(0);
      // 4 universal + 5 llm functional = 9 checks expected.
      expect(result.passed + result.skipped).toBeGreaterThanOrEqual(9);
    },
    30_000,
  );
});
