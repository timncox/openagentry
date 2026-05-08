/**
 * LlmAdapter.stream — streaming text generation via plain fetch + SSE
 * parser against OpenRouter's /chat/completions endpoint.
 *
 * Errors during streaming yield an error chunk rather than throw, matching
 * the LlmStreamChunk discriminated union.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmStreamChunk } from '@openagentry/core';
import { isAgentryError } from '@openagentry/core';
import type { OpenrouterLlmConfig } from '../config.js';
import {
  httpToOpenrouterError,
  networkErr,
  openrouterError,
  OPENROUTER_ERROR_CODES,
} from '../errors.js';
import { buildHeaders } from '../headers.js';
import { parseSseStream } from '../sse.js';

function resolveModelOrError(
  cfg: OpenrouterLlmConfig,
  opts?: LlmGenerateOpts,
): string | LlmStreamChunk {
  const model = opts?.model ?? cfg.defaultModel;
  if (model === undefined || model === '') {
    return {
      type: 'error',
      message:
        'E_OPENROUTER_CONFIG_INVALID: No LLM model resolvable. Pass opts.model or set OA_OPENROUTER_DEFAULT_MODEL.',
    };
  }
  return model;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

function buildMessages(prompt: string, system: string | undefined): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (typeof system === 'string' && system.length > 0) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function errorChunk(err: unknown): LlmStreamChunk {
  const wrapped = isAgentryError(err)
    ? err
    : openrouterError({
        code: OPENROUTER_ERROR_CODES.UPSTREAM,
        message: err instanceof Error ? err.message : String(err),
        phase: 'stream',
        suggestedFix: 'Inspect the cause; OpenRouter returned an unexpected error.',
        cause: err,
      });
  return { type: 'error', message: `${wrapped.code}: ${wrapped.message}` };
}

export async function* streamOp(
  cfg: OpenrouterLlmConfig,
  prompt: string,
  opts?: LlmGenerateOpts,
): AsyncIterable<LlmStreamChunk> {
  const resolved = resolveModelOrError(cfg, opts);
  if (typeof resolved !== 'string') {
    yield resolved;
    return;
  }
  const model = resolved;
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(prompt, opts?.system),
    stream: true,
  };
  if (opts?.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts?.temperature !== undefined) body.temperature = opts.temperature;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cfg, { json: true }),
      body: JSON.stringify(body),
    });
  } catch (err) {
    yield errorChunk(networkErr(err, 'stream'));
    return;
  }

  if (!response.ok) {
    yield errorChunk(await httpToOpenrouterError(response, 'stream'));
    return;
  }

  if (response.body === null) {
    yield errorChunk(
      openrouterError({
        code: OPENROUTER_ERROR_CODES.UPSTREAM,
        message: 'OpenRouter streaming response had no body',
        phase: 'stream',
        suggestedFix: 'Retry; if persistent, OpenRouter is misbehaving.',
      }),
    );
    return;
  }

  let sawDone = false;
  try {
    for await (const ev of parseSseStream(response.body)) {
      if (ev.kind === 'done') {
        sawDone = true;
        yield { type: 'done' };
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch (err) {
        yield errorChunk(
          openrouterError({
            code: OPENROUTER_ERROR_CODES.UPSTREAM,
            message: `Could not parse SSE chunk JSON: ${err instanceof Error ? err.message : String(err)}`,
            phase: 'stream',
            suggestedFix: 'OpenRouter sent a malformed SSE chunk. Capture err.cause for diagnostics.',
            cause: err,
          }),
        );
        return;
      }
      const content =
        (parsed as { choices?: Array<{ delta?: { content?: unknown } }> })?.choices?.[0]?.delta
          ?.content;
      if (typeof content === 'string' && content.length > 0) {
        yield { type: 'text', text: content };
      }
      // ignore deltas without content (role-only first chunk, etc.)
    }
  } catch (err) {
    yield errorChunk(networkErr(err, 'stream'));
    return;
  }

  if (!sawDone) {
    yield { type: 'done' };
  }
}
