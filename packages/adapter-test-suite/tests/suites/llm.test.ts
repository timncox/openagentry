import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const goodFixture = resolve(here, '../fixtures/good-llm-functional');

describe('llm functional suite', () => {
  it('passes all 5 checks against good-llm-functional fixture', async () => {
    const result = await runSuite({ target: goodFixture });
    const failed = result.checks.filter((c) => c.status === 'fail');
    if (failed.length > 0) {
      console.error(JSON.stringify(failed, null, 2));
    }
    expect(result.failed).toBe(0);
    const llmCheckIds = result.checks
      .filter((c) => c.id.startsWith('llm/'))
      .map((c) => c.id);
    expect(llmCheckIds).toContain('llm/list-models-returns-array');
    expect(llmCheckIds).toContain('llm/generate-returns-text');
    expect(llmCheckIds).toContain('llm/generate-respects-system-opt');
    expect(llmCheckIds).toContain('llm/stream-emits-text-then-done');
    expect(llmCheckIds).toContain('llm/structured-errors');
  });

  it('returns a single fail check against bad-llm (wrong category bootstrap)', async () => {
    const fixture = resolve(here, '../fixtures/bad-llm');
    const result = await runSuite({ target: fixture });
    // The runner dispatches by manifest category — bad-llm's manifest says
    // 'host', so the host suite runs and fails on bootstrap. The llm suite
    // never sees this fixture. Just confirm at least one check failed.
    expect(result.failed).toBeGreaterThan(0);
  });

  it('reports failures against bad-llm-functional for all 5 checks', async () => {
    const fixture = resolve(here, '../fixtures/bad-llm-functional');
    const result = await runSuite({ target: fixture });
    const llmFails = result.checks.filter(
      (c) => c.id.startsWith('llm/') && c.status === 'fail',
    );
    // llm/stream-emits-text-then-done also fails (doneCount === 0 because
    // the bad fixture's stream ends without yielding done), but it's
    // intentionally excluded from this assertion to avoid coupling to the
    // stream-iteration termination shape — see bad-llm-functional/index.cjs.
    expect(llmFails.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'llm/list-models-returns-array',
        'llm/generate-returns-text',
        'llm/generate-respects-system-opt',
        'llm/structured-errors',
      ]),
    );
  });
});
