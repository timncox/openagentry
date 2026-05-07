import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/email.js'; // side-effect: register the email suite
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const fixturesDir = resolve(dirname(__filename), '..', 'fixtures');

describe('email suite — bad-email fixture', () => {
  // Save and clear env vars so the opt-in functional check is skipped.
  const savedTo = process.env.EMAIL_CONFORMANCE_TEST_TO;
  const savedFrom = process.env.EMAIL_CONFORMANCE_TEST_FROM;
  beforeEach(() => {
    delete process.env.EMAIL_CONFORMANCE_TEST_TO;
    delete process.env.EMAIL_CONFORMANCE_TEST_FROM;
  });
  afterEach(() => {
    if (savedTo !== undefined) process.env.EMAIL_CONFORMANCE_TEST_TO = savedTo;
    if (savedFrom !== undefined) process.env.EMAIL_CONFORMANCE_TEST_FROM = savedFrom;
  });

  it('reports email/structured-errors as fail', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-email'),
      category: 'email',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).toContain('email/structured-errors');
  });

  it('reports docs/llm-md as fail (manifest has no llmDocs)', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-email'),
      category: 'email',
    });
    const failedIds = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(failedIds).toContain('docs/llm-md');
  });

  it('does not include email/send-returns-id-shape when env vars are unset', async () => {
    const result = await runSuite({
      target: resolve(fixturesDir, 'bad-email'),
      category: 'email',
    });
    const allIds = result.checks.map((c) => c.id);
    expect(allIds).not.toContain('email/send-returns-id-shape');
  });
});
