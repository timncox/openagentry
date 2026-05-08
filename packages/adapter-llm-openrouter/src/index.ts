/**
 * @openagentry/adapter-llm-openrouter — public exports + lazy default
 * export resolved from OA_OPENROUTER_* env vars.
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
  createOpenrouterLlmAdapter,
  type OpenrouterLlmAdapter,
  type OpenrouterLlmCapabilities,
} from './adapter.js';
import { readEnvConfig } from './env.js';
import { openrouterError, OPENROUTER_ERROR_CODES } from './errors.js';

export const ADAPTER_VERSION = '0.1.0-alpha.0' as const;

export { createOpenrouterLlmAdapter };
export type { OpenrouterLlmAdapter, OpenrouterLlmCapabilities };
export {
  parseOpenrouterLlmConfig,
  openrouterLlmConfigSchema,
  type OpenrouterLlmConfig,
  type OpenrouterLlmConfigInput,
} from './config.js';
export {
  ADAPTER_ID,
  OPENROUTER_ERROR_CODES,
  type OpenrouterErrorCode,
} from './errors.js';

let cached: OpenrouterLlmAdapter | undefined;

function buildFromEnv(): OpenrouterLlmAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (result.kind === 'missing') {
    throw openrouterError({
      code: OPENROUTER_ERROR_CODES.CONFIG_INVALID,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      suggestedFix: `Set ${result.missing.join(', ')} in your environment, or pass a config to createOpenrouterLlmAdapter() directly.`,
    });
  }
  if (result.kind === 'invalid') {
    const cause = result.error instanceof Error ? result.error.message : String(result.error);
    throw openrouterError({
      code: OPENROUTER_ERROR_CODES.CONFIG_INVALID,
      message: `OA_OPENROUTER_* env vars failed validation: ${cause}`,
      phase: 'init',
      suggestedFix:
        'Check OA_OPENROUTER_BASE_URL is a valid URL and OA_OPENROUTER_APP_URL (if set) is a valid URL.',
      cause: result.error,
    });
  }
  cached = createOpenrouterLlmAdapter(result.config);
  return cached;
}

const lazyAdapter: OpenrouterLlmAdapter = Object.freeze({
  category: 'llm',
  id: 'llm-openrouter',
  listModels: async (): Promise<LlmModel[]> => buildFromEnv().listModels(),
  generate: async (prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult> =>
    buildFromEnv().generate(prompt, opts),
  stream: (prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk> =>
    buildFromEnv().stream(prompt, opts),
  getCapabilities: (): OpenrouterLlmCapabilities => {
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
