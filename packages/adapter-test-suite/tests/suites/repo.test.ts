import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/repo.js'; // side-effect: register the repo suite
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const fixturesDir = resolve(dirname(__filename), '..', 'fixtures');

describe('repo suite — bad-repo fixture', () => {
  // Save and clear the opt-in env var so create-delete-roundtrip is skipped.
  const savedTestOwner = process.env.OA_REPO_CONFORMANCE_TEST_OWNER;
  beforeEach(() => {
    delete process.env.OA_REPO_CONFORMANCE_TEST_OWNER;
  });
  afterEach(() => {
    if (savedTestOwner !== undefined) {
      process.env.OA_REPO_CONFORMANCE_TEST_OWNER = savedTestOwner;
    }
  });

  it('reports repo/structured-errors as fail', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-repo'),
      category: 'repo',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).toContain('repo/structured-errors');
  });

  it('does not report docs/llm-md as fail (manifest has llmDocs pointing at existing LLM.md)', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-repo'),
      category: 'repo',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).not.toContain('docs/llm-md');
  });

  it('does not include repo/create-delete-roundtrip when OA_REPO_CONFORMANCE_TEST_OWNER is unset', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-repo'),
      category: 'repo',
    });
    const allIds = result.checks.map((c) => c.id);
    expect(allIds).not.toContain('repo/create-delete-roundtrip');
  });
});
