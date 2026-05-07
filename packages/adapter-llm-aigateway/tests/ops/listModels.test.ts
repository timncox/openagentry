import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { listModelsOp } from '../../src/ops/listModels.js';
import type { AigatewayLlmConfig } from '../../src/config.js';

const cfg: AigatewayLlmConfig = {
  apiKey: 'vck_TEST',
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('listModelsOp', () => {
  it('returns LlmModel[] from a happy response', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer vck_TEST');
        return HttpResponse.json({
          data: [
            { id: 'anthropic/claude-opus-4.6', context_window: 200_000, capabilities: { tools: true, vision: true } },
            { id: 'openai/gpt-5.4', context_window: 128_000 },
          ],
        });
      }),
    );
    const out = await listModelsOp(cfg);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'anthropic/claude-opus-4.6',
      label: 'anthropic/claude-opus-4.6',
      contextWindow: 200_000,
      capabilities: { streaming: true, tools: true, vision: true },
    });
    expect(out[1]).toEqual({
      id: 'openai/gpt-5.4',
      label: 'openai/gpt-5.4',
      contextWindow: 128_000,
      capabilities: { streaming: true },
    });
  });

  it('throws E_AIGATEWAY_AUTH on 401', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );
    await expect(listModelsOp(cfg)).rejects.toMatchObject({
      code: 'E_AIGATEWAY_AUTH',
      phase: 'listModels',
    });
  });

  it('throws E_AIGATEWAY_UPSTREAM on 500', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.text('boom', { status: 500 }),
      ),
    );
    await expect(listModelsOp(cfg)).rejects.toMatchObject({
      code: 'E_AIGATEWAY_UPSTREAM',
      phase: 'listModels',
    });
  });

  it('throws E_AIGATEWAY_NETWORK on network failure', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () => HttpResponse.error()),
    );
    await expect(listModelsOp(cfg)).rejects.toMatchObject({
      code: 'E_AIGATEWAY_NETWORK',
      phase: 'listModels',
    });
  });

  it('returns [] when data field is missing', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.json({ object: 'list' }),
      ),
    );
    const out = await listModelsOp(cfg);
    expect(out).toEqual([]);
  });

  it('skips entries with missing or non-string id', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.json({
          data: [{ id: 'good/model', context_window: 1024 }, { context_window: 2048 }, { id: '', context_window: 1024 }, { id: 42 }],
        }),
      ),
    );
    const out = await listModelsOp(cfg);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('good/model');
  });

  it('defaults contextWindow to 0 when missing', async () => {
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.json({ data: [{ id: 'x/y' }] }),
      ),
    );
    const out = await listModelsOp(cfg);
    expect(out[0]?.contextWindow).toBe(0);
  });

  it('handles trailing slash in baseUrl', async () => {
    const cfg2: AigatewayLlmConfig = { ...cfg, baseUrl: 'https://ai-gateway.vercel.sh/v1/' };
    server.use(
      http.get('https://ai-gateway.vercel.sh/v1/models', () =>
        HttpResponse.json({ data: [{ id: 'a/b', context_window: 1 }] }),
      ),
    );
    const out = await listModelsOp(cfg2);
    expect(out).toHaveLength(1);
  });
});
