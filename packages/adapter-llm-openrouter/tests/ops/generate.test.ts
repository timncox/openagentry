import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { generateOp } from '../../src/ops/generate.js';
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

const stdReply = {
  id: 'gen-1',
  choices: [{ message: { role: 'assistant', content: 'hello!' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
};

describe('generateOp', () => {
  it('returns text + model from happy path', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () => HttpResponse.json(stdReply)),
    );
    const r = await generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' });
    expect(r).toEqual({
      text: 'hello!',
      model: 'openai/gpt-5.2',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('omits usage when response lacks it', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({ ...stdReply, usage: undefined }),
      ),
    );
    const r = await generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' });
    expect(r.usage).toBeUndefined();
  });

  it('uses cfg.defaultModel when opts.model unset', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () => HttpResponse.json(stdReply)),
    );
    const r = await generateOp(
      { ...cfg, defaultModel: 'anthropic/claude-opus-4.6' },
      'Say hi.',
    );
    expect(r.model).toBe('anthropic/claude-opus-4.6');
  });

  it('throws CONFIG_INVALID when no model resolvable', async () => {
    await expect(generateOp(cfg, 'Say hi.')).rejects.toMatchObject({
      code: 'E_OPENROUTER_CONFIG_INVALID',
      phase: 'generate',
    });
  });

  it('sends system message as first message when opts.system set', async () => {
    let seenBody: { messages?: Array<{ role: string; content: string }> } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(stdReply);
      }),
    );
    await generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2', system: 'You are helpful.' });
    expect(seenBody.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Say hi.' },
    ]);
  });

  it('omits system message when opts.system unset', async () => {
    let seenBody: { messages?: Array<{ role: string; content: string }> } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(stdReply);
      }),
    );
    await generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' });
    expect(seenBody.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
  });

  it('forwards maxTokens + temperature to body', async () => {
    let seenBody: { max_tokens?: number; temperature?: number; stream?: boolean } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(stdReply);
      }),
    );
    await generateOp(cfg, 'Say hi.', {
      model: 'openai/gpt-5.2',
      maxTokens: 200,
      temperature: 0.7,
    });
    expect(seenBody.max_tokens).toBe(200);
    expect(seenBody.temperature).toBe(0.7);
    expect(seenBody.stream).toBe(false);
  });

  it('throws AUTH on 401', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({ error: { message: 'bad key' } }, { status: 401 }),
      ),
    );
    await expect(generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' })).rejects.toMatchObject({
      code: 'E_OPENROUTER_AUTH',
    });
  });

  it('throws RATE_LIMIT on 429 with retryAfter', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json(
          { error: { message: 'too many' } },
          { status: 429, headers: { 'Retry-After': '15' } },
        ),
      ),
    );
    const err = await generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' }).catch((e) => e);
    expect(err.code).toBe('E_OPENROUTER_RATE_LIMIT');
    expect(err.context).toMatchObject({ retryAfter: 15 });
  });

  it('throws NOT_FOUND on 404', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({ error: { message: 'no such model' } }, { status: 404 }),
      ),
    );
    await expect(generateOp(cfg, 'Say hi.', { model: 'bogus/model' })).rejects.toMatchObject({
      code: 'E_OPENROUTER_NOT_FOUND',
    });
  });

  it('throws NOT_FOUND on 400 + model_not_found code', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json(
          { error: { code: 'model_not_found', message: 'unknown model' } },
          { status: 400 },
        ),
      ),
    );
    await expect(generateOp(cfg, 'Say hi.', { model: 'bogus/model' })).rejects.toMatchObject({
      code: 'E_OPENROUTER_NOT_FOUND',
    });
  });

  it('throws UPSTREAM on 500', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({ error: { message: 'oops' } }, { status: 500 }),
      ),
    );
    await expect(generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' })).rejects.toMatchObject({
      code: 'E_OPENROUTER_UPSTREAM',
    });
  });

  it('throws NETWORK when fetch fails', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () => HttpResponse.error()),
    );
    await expect(generateOp(cfg, 'Say hi.', { model: 'openai/gpt-5.2' })).rejects.toMatchObject({
      code: 'E_OPENROUTER_NETWORK',
    });
  });

  it('sends attribution headers when configured', async () => {
    let seenReferer: string | null = null;
    server.use(
      http.post(`${BASE}/chat/completions`, ({ request }) => {
        seenReferer = request.headers.get('HTTP-Referer');
        return HttpResponse.json(stdReply);
      }),
    );
    await generateOp(
      { ...cfg, appUrl: 'https://my-app.example.com', appTitle: 'My App' },
      'Say hi.',
      { model: 'openai/gpt-5.2' },
    );
    expect(seenReferer).toBe('https://my-app.example.com');
  });
});
