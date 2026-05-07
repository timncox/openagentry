import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';

vi.mock('ai', async () => {
  const { makeSdkMock } = await import('./conformance/sdk-mock.js');
  return makeSdkMock();
});

const TOKEN = 'vck_TEST';
const BASE_URL = 'https://ai-gateway.vercel.sh/v1';

const server = setupServer(
  http.get(`${BASE_URL}/models`, () =>
    HttpResponse.json({
      data: [
        { id: 'anthropic/claude-opus-4.6', context_window: 200_000, capabilities: { tools: true, vision: true } },
        { id: 'openai/gpt-5.4', context_window: 128_000 },
      ],
    }),
  ),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  process.env.OA_AIGATEWAY_API_KEY = TOKEN;
  process.env.OA_AIGATEWAY_DEFAULT_MODEL = 'anthropic/claude-opus-4.6';
});

afterAll(() => {
  server.close();
  delete process.env.OA_AIGATEWAY_API_KEY;
  delete process.env.OA_AIGATEWAY_DEFAULT_MODEL;
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
