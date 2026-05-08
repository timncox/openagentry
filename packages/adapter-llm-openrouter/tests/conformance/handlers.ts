/**
 * MSW handlers driving the conformance suite. Inspect prompt content to
 * route to: error trigger / echo system / count stream / default reply.
 *
 * Plain-fetch adapter — no SDK to mock at module level. All HTTP traffic
 * is interceptable via MSW; this file is the single source of truth for
 * suite behavior.
 *
 * @module
 */

import { http, HttpResponse, delay } from 'msw';
import { ECHO_PROMPT, ERROR_PROMPT, SYSTEM_MARKER } from './prompts.js';

const BASE = 'https://openrouter.ai/api/v1';

interface ChatRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
}

function getUserPrompt(body: ChatRequestBody): string {
  const last = body.messages[body.messages.length - 1];
  return typeof last?.content === 'string' ? last.content : '';
}

function getSystemPrompt(body: ChatRequestBody): string {
  const sys = body.messages.find((m) => m.role === 'system');
  return typeof sys?.content === 'string' ? sys.content : '';
}

function buildText(body: ChatRequestBody): string {
  const user = getUserPrompt(body);
  const sys = getSystemPrompt(body);
  if (user.includes(ECHO_PROMPT) && sys.includes(SYSTEM_MARKER)) {
    return `system says: ${sys}`;
  }
  return 'mock response';
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function ssePayload(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function streamFor(body: ChatRequestBody): ReadableStream<Uint8Array> {
  const user = getUserPrompt(body);
  if (user.includes(ERROR_PROMPT)) {
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc('data: {"choices":[{"delta":{"content":"start"}}]}\n\n'));
        // emit something parseable then abort by closing without [DONE] — but
        // we want the suite to see at least one text chunk + one done so it
        // counts as a *successful* stream. The error trigger here is for the
        // generate-respects-error path, not stream.
        ctrl.enqueue(enc('data: [DONE]\n\n'));
        ctrl.close();
      },
    });
  }
  const chunks = ['one ', 'two ', 'three'];
  return new ReadableStream({
    async start(ctrl) {
      for (const c of chunks) {
        ctrl.enqueue(enc(ssePayload(c)));
      }
      ctrl.enqueue(enc('data: [DONE]\n\n'));
      ctrl.close();
    },
  });
}

export const handlers = [
  http.get(`${BASE}/models`, () =>
    HttpResponse.json({
      data: [
        { id: 'openai/gpt-5.2', name: 'OpenAI: GPT-5.2', context_length: 128_000 },
        { id: 'anthropic/claude-opus-4.6', name: 'Anthropic: Claude Opus 4.6', context_length: 200_000 },
      ],
    }),
  ),

  http.post(`${BASE}/chat/completions`, async ({ request }) => {
    const body = (await request.json()) as ChatRequestBody;
    const user = getUserPrompt(body);

    if (user.includes(ERROR_PROMPT) && body.stream !== true) {
      // generate path — return an HTTP error so the suite's structured-errors
      // check sees an AgentryError thrown.
      return HttpResponse.json({ error: { message: 'triggered upstream error' } }, { status: 500 });
    }

    if (body.stream === true) {
      return new HttpResponse(streamFor(body), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    return HttpResponse.json({
      id: 'gen-1',
      choices: [{ message: { role: 'assistant', content: buildText(body) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  }),
];
