/**
 * @openagentry/adapter-llm-aigateway — public exports + lazy default
 * export resolved from OA_AIGATEWAY_* env vars.
 *
 * @module
 */

import type {
  LlmGenerateOpts,
  LlmGenerateResult,
  LlmModel,
  LlmStreamChunk,
} from '@openagentry/core';
import {
  createAigatewayLlmAdapter,
  type AigatewayLlmAdapter,
  type AigatewayLlmCapabilities,
} from './adapter.js';
import { readEnvConfig } from './env.js';
import { aigatewayError, AIGATEWAY_ERROR_CODES } from './errors.js';

export const ADAPTER_VERSION = '0.1.0-alpha.0' as const;

export { createAigatewayLlmAdapter };
export type { AigatewayLlmAdapter, AigatewayLlmCapabilities };
export {
  parseAigatewayLlmConfig,
  aigatewayLlmConfigSchema,
  type AigatewayLlmConfig,
  type AigatewayLlmConfigInput,
} from './config.js';
export {
  ADAPTER_ID,
  AIGATEWAY_ERROR_CODES,
  type AigatewayErrorCode,
} from './errors.js';

let cached: AigatewayLlmAdapter | undefined;

function buildFromEnv(): AigatewayLlmAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (result.kind === 'missing') {
    throw aigatewayError({
      code: AIGATEWAY_ERROR_CODES.CONFIG_INVALID,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      suggestedFix: `Set ${result.missing.join(', ')} in your environment, or pass a config to createAigatewayLlmAdapter() directly.`,
    });
  }
  if (result.kind === 'invalid') {
    const cause = result.error instanceof Error ? result.error.message : String(result.error);
    throw aigatewayError({
      code: AIGATEWAY_ERROR_CODES.CONFIG_INVALID,
      message: `OA_AIGATEWAY_* env vars failed validation: ${cause}`,
      phase: 'init',
      suggestedFix:
        'Check OA_AIGATEWAY_BASE_URL is a valid URL and OA_AIGATEWAY_DEFAULT_MODEL is non-empty if set.',
      cause: result.error,
    });
  }
  cached = createAigatewayLlmAdapter(result.config);
  return cached;
}

// Lazy adapter: synchronous buildFromEnv() throws are wrapped as rejected
// promises by `async` on listModels/generate (call sites always `await`).
// `stream` returns AsyncIterable, not a Promise, so it stays a bare arrow —
// sync throws there bubble up through the for-await consumer.
const lazyAdapter: AigatewayLlmAdapter = Object.freeze({
  category: 'llm',
  id: 'llm-aigateway',
  listModels: async (): Promise<LlmModel[]> => buildFromEnv().listModels(),
  generate: async (prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult> =>
    buildFromEnv().generate(prompt, opts),
  stream: (prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk> =>
    buildFromEnv().stream(prompt, opts),
  getCapabilities: (): AigatewayLlmCapabilities => {
    // Capability inquiry should not throw on missing env — return the static caps.
    try {
      return buildFromEnv().getCapabilities();
    } catch {
      return {
        streaming: true,
        tools: false,
        vision: false,
        embeddings: false,
        runtime: true,
      };
    }
  },
});

export default lazyAdapter;
