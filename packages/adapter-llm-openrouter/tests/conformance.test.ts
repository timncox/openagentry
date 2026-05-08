import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { runSuite } from '@openagentry/adapter-test-suite';
import { handlers } from './conformance/handlers.js';

const server = setupServer(...handlers);

const TOKEN = 'sk-or-v1-test-conformance';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterAll(() => {
  server.close();
  delete process.env.OA_OPENROUTER_API_KEY;
  delete process.env.OA_OPENROUTER_DEFAULT_MODEL;
});

beforeEach(() => {
  process.env.OA_OPENROUTER_API_KEY = TOKEN;
  process.env.OA_OPENROUTER_DEFAULT_MODEL = 'openai/gpt-5.2';
});

describe('conformance — adapter-test-suite llm', () => {
  it('passes universal + llm functional checks', async () => {
    const suiteResult = await runSuite({
      category: 'llm',
      target: __dirname + '/..',
    });
    const results = suiteResult.checks;
    const failures = results.filter((r) => r.status === 'fail');
    if (failures.length > 0) {
      console.error(failures.map((f) => `${f.id}: ${f.message ?? '<no message>'}`).join('\n'));
    }
    expect(failures).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(8);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('llm/list-models-returns-array');
    expect(ids).toContain('llm/generate-returns-text');
    expect(ids).toContain('llm/generate-respects-system-opt');
    expect(ids).toContain('llm/stream-emits-text-then-done');
    expect(ids).toContain('llm/structured-errors');
  }, 30_000);
});
