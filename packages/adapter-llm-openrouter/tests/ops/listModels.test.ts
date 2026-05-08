import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { listModelsOp } from '../../src/ops/listModels.js';
import type { OpenrouterLlmConfig } from '../../src/config.js';

const BASE = 'https://openrouter.ai/api/v1';
const cfg: OpenrouterLlmConfig = {
  apiKey: 'sk-or-v1-test',
  baseUrl: BASE,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('listModelsOp', () => {
  it('maps OpenRouter /models response to LlmModel[]', async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({
          data: [
            { id: 'openai/gpt-5.2', name: 'OpenAI: GPT-5.2', context_length: 128_000 },
            { id: 'anthropic/claude-opus-4.6', name: 'Anthropic: Claude Opus 4.6', context_length: 200_000 },
          ],
        }),
      ),
    );

    const models = await listModelsOp(cfg);
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'openai/gpt-5.2',
      label: 'OpenAI: GPT-5.2',
      contextWindow: 128_000,
    });
    expect(models[1]?.label).toBe('Anthropic: Claude Opus 4.6');
  });

  it('falls back to id for label when name absent', async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({
          data: [{ id: 'foo/bar', context_length: 8192 }],
        }),
      ),
    );

    const models = await listModelsOp(cfg);
    expect(models[0]?.label).toBe('foo/bar');
  });

  it('falls back to 0 for contextWindow when context_length absent', async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({
          data: [{ id: 'foo/bar', name: 'Foo Bar' }],
        }),
      ),
    );

    const models = await listModelsOp(cfg);
    expect(models[0]?.contextWindow).toBe(0);
  });

  it('skips entries with non-string id', async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({
          data: [
            { id: 'good/model', name: 'Good', context_length: 4096 },
            { id: 42, name: 'Bad' },
            { name: 'Missing id' },
          ],
        }),
      ),
    );

    const models = await listModelsOp(cfg);
    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe('good/model');
  });

  it('returns empty array when data missing', async () => {
    server.use(
      http.get(`${BASE}/models`, () => HttpResponse.json({})),
    );

    const models = await listModelsOp(cfg);
    expect(models).toEqual([]);
  });

  it('sends Authorization header with Bearer token', async () => {
    let seenAuth: string | null = null;
    server.use(
      http.get(`${BASE}/models`, ({ request }) => {
        seenAuth = request.headers.get('Authorization');
        return HttpResponse.json({ data: [] });
      }),
    );

    await listModelsOp(cfg);
    expect(seenAuth).toBe('Bearer sk-or-v1-test');
  });

  it('sends attribution headers when configured', async () => {
    let seenReferer: string | null = null;
    let seenTitle: string | null = null;
    server.use(
      http.get(`${BASE}/models`, ({ request }) => {
        seenReferer = request.headers.get('HTTP-Referer');
        seenTitle = request.headers.get('X-OpenRouter-Title');
        return HttpResponse.json({ data: [] });
      }),
    );

    await listModelsOp({
      ...cfg,
      appUrl: 'https://my-app.example.com',
      appTitle: 'My App',
    });
    expect(seenReferer).toBe('https://my-app.example.com');
    expect(seenTitle).toBe('My App');
  });

  it('omits attribution headers when not configured', async () => {
    let seenReferer: string | null = null;
    let seenTitle: string | null = null;
    server.use(
      http.get(`${BASE}/models`, ({ request }) => {
        seenReferer = request.headers.get('HTTP-Referer');
        seenTitle = request.headers.get('X-OpenRouter-Title');
        return HttpResponse.json({ data: [] });
      }),
    );

    await listModelsOp(cfg);
    expect(seenReferer).toBeNull();
    expect(seenTitle).toBeNull();
  });

  it('throws AUTH on 401', async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({ error: { message: 'bad key' } }, { status: 401 }),
      ),
    );

    await expect(listModelsOp(cfg)).rejects.toMatchObject({
      code: 'E_OPENROUTER_AUTH',
      phase: 'listModels',
    });
  });

  it('throws NETWORK on fetch failure', async () => {
    server.use(
      http.get(`${BASE}/models`, () => HttpResponse.error()),
    );

    await expect(listModelsOp(cfg)).rejects.toMatchObject({
      code: 'E_OPENROUTER_NETWORK',
      phase: 'listModels',
    });
  });
});
