import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { streamOp } from '../../src/ops/stream.js';
import type { OpenrouterLlmConfig } from '../../src/config.js';
import type { LlmStreamChunk } from '@openagentry/core';

const BASE = 'https://openrouter.ai/api/v1';
const cfg: OpenrouterLlmConfig = {
  apiKey: 'sk-or-v1-test',
  baseUrl: BASE,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i < events.length) {
        ctrl.enqueue(enc(events[i]!));
        i++;
      } else {
        ctrl.close();
      }
    },
  });
}

async function collect(it: AsyncIterable<LlmStreamChunk>): Promise<LlmStreamChunk[]> {
  const out: LlmStreamChunk[] = [];
  for await (const c of it) out.push(c);
  return out;
}

describe('streamOp', () => {
  it('yields text chunks then done for happy path', async () => {
    const events = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        new HttpResponse(sseStream(events), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done' },
    ]);
  });

  it('skips delta events without content', async () => {
    const events = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        new HttpResponse(sseStream(events), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks).toEqual([{ type: 'text', text: 'x' }, { type: 'done' }]);
  });

  it('yields done at end-of-stream even without [DONE] sentinel', async () => {
    const events = ['data: {"choices":[{"delta":{"content":"x"}}]}\n\n'];
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        new HttpResponse(sseStream(events), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks).toEqual([{ type: 'text', text: 'x' }, { type: 'done' }]);
  });

  it('yields error chunk on pre-stream HTTP error (does not throw)', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({ error: { message: 'bad' } }, { status: 401 }),
      ),
    );
    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.type).toBe('error');
    if (chunks[0]?.type === 'error') {
      expect(chunks[0].message).toContain('E_OPENROUTER_AUTH');
    }
  });

  it('yields error chunk on fetch failure (does not throw)', async () => {
    server.use(
      http.post(`${BASE}/chat/completions`, () => HttpResponse.error()),
    );
    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks[0]?.type).toBe('error');
    if (chunks[0]?.type === 'error') {
      expect(chunks[0].message).toContain('E_OPENROUTER_NETWORK');
    }
  });

  it('yields error chunk on missing-model (does not throw)', async () => {
    const chunks = await collect(streamOp(cfg, 'Hi.'));
    expect(chunks[0]?.type).toBe('error');
    if (chunks[0]?.type === 'error') {
      expect(chunks[0].message).toContain('E_OPENROUTER_CONFIG_INVALID');
    }
  });

  it('yields error chunk on mid-stream parse error (does not throw)', async () => {
    const events = [
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
      'data: not-valid-json\n\n',
      'data: [DONE]\n\n',
    ];
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        new HttpResponse(sseStream(events), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );
    const chunks = await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(chunks[0]).toEqual({ type: 'text', text: 'x' });
    expect(chunks[1]?.type).toBe('error');
  });

  it('sends stream:true in body', async () => {
    let seenBody: { stream?: boolean } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request }) => {
        seenBody = await request.json();
        return new HttpResponse(sseStream(['data: [DONE]\n\n']), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );
    await collect(streamOp(cfg, 'Hi.', { model: 'openai/gpt-5.2' }));
    expect(seenBody.stream).toBe(true);
  });
});
