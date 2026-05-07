/**
 * LlmAdapter.generate — single-shot text generation via plain fetch
 * against OpenRouter's /chat/completions endpoint (OpenAI-compatible).
 *
 * @module
 */

import type { LlmGenerateOpts, LlmGenerateResult } from '@openagentry/core';
import type { OpenrouterLlmConfig } from '../config.js';
import {
  httpToOpenrouterError,
  networkErr,
  openrouterError,
  OPENROUTER_ERROR_CODES,
} from '../errors.js';
import { buildHeaders } from '../headers.js';

interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface RawCompletion {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: RawUsage;
}

function resolveModel(cfg: OpenrouterLlmConfig, opts?: LlmGenerateOpts): string {
  const model = opts?.model ?? cfg.defaultModel;
  if (model === undefined || model === '') {
    throw openrouterError({
      code: OPENROUTER_ERROR_CODES.CONFIG_INVALID,
      message: 'No LLM model resolvable: pass opts.model or set OA_OPENROUTER_DEFAULT_MODEL.',
      phase: 'generate',
      suggestedFix:
        'Either pass `model` in opts (e.g., "openai/gpt-5.2"), or set OA_OPENROUTER_DEFAULT_MODEL.',
    });
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

function mapUsage(u: RawUsage | undefined): LlmGenerateResult['usage'] | undefined {
  if (u === undefined) return undefined;
  if (typeof u.prompt_tokens !== 'number' && typeof u.completion_tokens !== 'number') return undefined;
  return {
    inputTokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
    outputTokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
  };
}

export async function generateOp(
  cfg: OpenrouterLlmConfig,
  prompt: string,
  opts?: LlmGenerateOpts,
): Promise<LlmGenerateResult> {
  const model = resolveModel(cfg, opts);
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(prompt, opts?.system),
    stream: false,
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
    throw networkErr(err, 'generate');
  }

  if (!response.ok) {
    throw await httpToOpenrouterError(response, 'generate');
  }

  let json: RawCompletion;
  try {
    json = (await response.json()) as RawCompletion;
  } catch (err) {
    throw networkErr(err, 'generate');
  }

  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw openrouterError({
      code: OPENROUTER_ERROR_CODES.UPSTREAM,
      message: 'OpenRouter response missing choices[0].message.content',
      phase: 'generate',
      suggestedFix: 'Inspect the response body. The provider may be returning a non-text completion.',
      context: { receivedShape: Object.keys(json) },
    });
  }

  const out: LlmGenerateResult = { text, model };
  const usage = mapUsage(json.usage);
  if (usage !== undefined) out.usage = usage;
  return out;
}
