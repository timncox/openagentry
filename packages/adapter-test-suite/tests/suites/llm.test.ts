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
});
