/**
 * LlmAdapter.generate — single-shot text generation via SDK generateText.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmGenerateResult } from '@openagentry/core';
import { generateText } from 'ai';
import type { AigatewayLlmConfig } from '../config.js';
import { aigatewayError, AIGATEWAY_ERROR_CODES, sdkErrorToAigatewayError } from '../errors.js';

interface SdkUsage {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface SdkGenerateResult {
  text: string;
  usage?: SdkUsage;
}

function resolveModel(cfg: AigatewayLlmConfig, opts?: LlmGenerateOpts): string {
  const model = opts?.model ?? cfg.defaultModel;
  if (model === undefined || model === '') {
    throw aigatewayError({
      code: AIGATEWAY_ERROR_CODES.CONFIG_INVALID,
      message: 'No LLM model resolvable: pass opts.model or set OA_AIGATEWAY_DEFAULT_MODEL.',
      phase: 'generate',
      suggestedFix:
        'Either pass `model` in opts, or set OA_AIGATEWAY_DEFAULT_MODEL (e.g., "anthropic/claude-opus-4.6").',
    });
  }
  return model;
}

function mapUsage(u: SdkUsage | undefined): LlmGenerateResult['usage'] | undefined {
  if (u === undefined) return undefined;
  const inputTokens = u.inputTokens ?? u.promptTokens ?? 0;
  const outputTokens = u.outputTokens ?? u.completionTokens ?? 0;
  return { inputTokens, outputTokens };
}

/**
 * The `ai` SDK reads the gateway API key from `AI_GATEWAY_API_KEY`. We set
 * it from cfg before each call so the operator's `OA_AIGATEWAY_API_KEY`
 * flows through without requiring them to set both names.
 */
function ensureGatewayEnv(cfg: AigatewayLlmConfig): void {
  process.env.AI_GATEWAY_API_KEY = cfg.apiKey;
  if (cfg.baseUrl !== 'https://ai-gateway.vercel.sh/v1') {
    process.env.AI_GATEWAY_BASE_URL = cfg.baseUrl;
  }
}

export async function generateOp(
  cfg: AigatewayLlmConfig,
  prompt: string,
  opts?: LlmGenerateOpts,
): Promise<LlmGenerateResult> {
  const model = resolveModel(cfg, opts);
  ensureGatewayEnv(cfg);

  const sdkOpts: Record<string, unknown> = { model, prompt };
  if (opts?.system !== undefined) sdkOpts.system = opts.system;
  if (opts?.maxTokens !== undefined) sdkOpts.maxOutputTokens = opts.maxTokens;
  if (opts?.temperature !== undefined) sdkOpts.temperature = opts.temperature;

  let result: SdkGenerateResult;
  try {
    result = (await generateText(sdkOpts as Parameters<typeof generateText>[0])) as unknown as SdkGenerateResult;
  } catch (err) {
    throw sdkErrorToAigatewayError(err, 'generate');
  }

  const out: LlmGenerateResult = {
    text: result.text,
    model,
  };
  const usage = mapUsage(result.usage);
  if (usage !== undefined) {
    out.usage = usage;
  }
  return out;
}
