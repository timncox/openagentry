/**
 * OpenRouter LLM adapter factory: validates config + wires ops into the
 * LlmAdapter shape.
 *
 * @module
 */

import type {
  LlmAdapter,
  LlmGenerateOpts,
  LlmGenerateResult,
  LlmModel,
  LlmStreamChunk,
} from '@openagentry/core';
import {
  parseOpenrouterLlmConfig,
  type OpenrouterLlmConfig,
  type OpenrouterLlmConfigInput,
} from './config.js';
import { listModelsOp } from './ops/listModels.js';
import { generateOp } from './ops/generate.js';
import { streamOp } from './ops/stream.js';

export interface OpenrouterLlmCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  embeddings: boolean;
  runtime: boolean;
}

export interface OpenrouterLlmAdapter extends LlmAdapter {
  readonly category: 'llm';
  readonly id: 'llm-openrouter';
  getCapabilities(): OpenrouterLlmCapabilities;
}

const STATIC_CAPS: OpenrouterLlmCapabilities = Object.freeze({
  streaming: true,
  tools: false,
  vision: false,
  embeddings: false,
  runtime: true,
});

export function createOpenrouterLlmAdapter(
  input: OpenrouterLlmConfigInput,
): OpenrouterLlmAdapter {
  const cfg: OpenrouterLlmConfig = parseOpenrouterLlmConfig(input);
  const adapter: OpenrouterLlmAdapter = {
    category: 'llm',
    id: 'llm-openrouter',
    listModels: (): Promise<LlmModel[]> => listModelsOp(cfg),
    generate: (prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult> =>
      generateOp(cfg, prompt, opts),
    stream: (prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk> =>
      streamOp(cfg, prompt, opts),
    getCapabilities: (): OpenrouterLlmCapabilities => STATIC_CAPS,
  };
  return Object.freeze(adapter);
}
