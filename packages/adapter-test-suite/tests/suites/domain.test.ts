import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/domain.js'; // side-effect: register the domain suite
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const fixturesDir = resolve(dirname(__filename), '..', 'fixtures');

describe('domain suite — bad-domain fixture', () => {
  // Save and clear the opt-in env var so dns-roundtrip is skipped throughout.
  const savedTestDomain = process.env.OA_DOMAIN_CONFORMANCE_TEST_DOMAIN;
  beforeEach(() => {
    delete process.env.OA_DOMAIN_CONFORMANCE_TEST_DOMAIN;
  });
  afterEach(() => {
    if (savedTestDomain !== undefined) {
      process.env.OA_DOMAIN_CONFORMANCE_TEST_DOMAIN = savedTestDomain;
    }
  });

  it('reports domain/structured-errors as fail', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-domain'),
      category: 'domain',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).toContain('domain/structured-errors');
  });

  it('does not report docs/llm-md as fail (manifest has llmDocs pointing at existing LLM.md)', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-domain'),
      category: 'domain',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).not.toContain('docs/llm-md');
  });

  it('does not include domain/dns-roundtrip when OA_DOMAIN_CONFORMANCE_TEST_DOMAIN is unset', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-domain'),
      category: 'domain',
    });
    const allIds = result.checks.map((c) => c.id);
    expect(allIds).not.toContain('domain/dns-roundtrip');
  });
});
