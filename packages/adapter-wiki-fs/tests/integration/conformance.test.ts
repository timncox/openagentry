import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runSuite } from '@openagentry/adapter-test-suite';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '../..');
let tempVault: string;
const previousPath = process.env['OA_WIKI_FS_WORKSPACE_PATH'];

beforeAll(async () => {
  tempVault = await mkdtemp(join(tmpdir(), 'agentry-wiki-conformance-'));
  process.env['OA_WIKI_FS_WORKSPACE_PATH'] = tempVault;
  await writeFile(
    join(tempVault, 'seed.md'),
    '---\ntitle: Seed\n---\n\nSeed content.\n',
  );
});

afterAll(async () => {
  await rm(tempVault, { recursive: true, force: true });
  if (previousPath === undefined) delete process.env['OA_WIKI_FS_WORKSPACE_PATH'];
  else process.env['OA_WIKI_FS_WORKSPACE_PATH'] = previousPath;
});

describe('integration: wiki conformance against the local package default', () => {
  it(
    'passes universal + wiki functional suites',
    async () => {
      const result = await runSuite({ target: packageDir });
      const failed = result.checks.filter((c) => c.status === 'fail');
      if (failed.length > 0) console.error(JSON.stringify(failed, null, 2));
      expect(result.failed).toBe(0);
      // 4 universal + 6 wiki functional = 10 checks expected.
      expect(result.passed + result.skipped).toBeGreaterThanOrEqual(10);
    },
    30_000,
  );
});
