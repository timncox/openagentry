/**
 * LlmAdapter.stream — streaming text generation via SDK streamText.
 *
 * Errors during streaming yield an error chunk rather than throw — matches
 * the `LlmStreamChunk` discriminated union so callers' for-await loops can
 * handle errors uniformly with text/done.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmStreamChunk } from '@openagentry/core';
import { isAgentryError } from '@openagentry/core';
import { streamText } from 'ai';
import type { AigatewayLlmConfig } from '../config.js';
import { aigatewayError, AIGATEWAY_ERROR_CODES, sdkErrorToAigatewayError } from '../errors.js';

interface SdkUsage {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface SdkStreamResult {
  textStream: AsyncIterable<string>;
  usage: Promise<SdkUsage | undefined>;
}

function resolveModelOrError(
  cfg: AigatewayLlmConfig,
  opts?: LlmGenerateOpts,
): string | LlmStreamChunk {
  const model = opts?.model ?? cfg.defaultModel;
  if (model === undefined || model === '') {
    return {
      type: 'error',
      message:
        'E_AIGATEWAY_CONFIG_INVALID: No LLM model resolvable. Pass opts.model or set OA_AIGATEWAY_DEFAULT_MODEL.',
    };
  }
  return model;
}

function mapUsage(u: SdkUsage | undefined): { inputTokens: number; outputTokens: number } | undefined {
  if (u === undefined) return undefined;
  const inputTokens = u.inputTokens ?? u.promptTokens ?? 0;
  const outputTokens = u.outputTokens ?? u.completionTokens ?? 0;
  return { inputTokens, outputTokens };
}

function ensureGatewayEnv(cfg: AigatewayLlmConfig): void {
  process.env.AI_GATEWAY_API_KEY = cfg.apiKey;
  if (cfg.baseUrl !== 'https://ai-gateway.vercel.sh/v1') {
    process.env.AI_GATEWAY_BASE_URL = cfg.baseUrl;
  }
}

function errorChunk(err: unknown): LlmStreamChunk {
  const wrapped = isAgentryError(err) ? err : sdkErrorToAigatewayError(err, 'stream');
  return { type: 'error', message: `${wrapped.code}: ${wrapped.message}` };
}

export async function* streamOp(
  cfg: AigatewayLlmConfig,
  prompt: string,
  opts?: LlmGenerateOpts,
): AsyncIterable<LlmStreamChunk> {
  const resolved = resolveModelOrError(cfg, opts);
  if (typeof resolved !== 'string') {
    yield resolved;
    return;
  }
  const model = resolved;
  ensureGatewayEnv(cfg);

  const sdkOpts: Record<string, unknown> = { model, prompt };
  if (opts?.system !== undefined) sdkOpts.system = opts.system;
  if (opts?.maxTokens !== undefined) sdkOpts.maxOutputTokens = opts.maxTokens;
  if (opts?.temperature !== undefined) sdkOpts.temperature = opts.temperature;

  let result: SdkStreamResult;
  try {
    result = streamText(sdkOpts as Parameters<typeof streamText>[0]) as unknown as SdkStreamResult;
  } catch (err) {
    yield errorChunk(err);
    return;
  }

  let iterationFailed = false;
  try {
    for await (const delta of result.textStream) {
      yield { type: 'text', text: delta };
    }
  } catch (err) {
    iterationFailed = true;
    yield errorChunk(err);
  }

  if (iterationFailed) return;

  let usage: SdkUsage | undefined;
  try {
    usage = await result.usage;
  } catch {
    usage = undefined;
  }
  const mapped = mapUsage(usage);
  yield mapped !== undefined ? { type: 'done', usage: mapped } : { type: 'done' };
}
