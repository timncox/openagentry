/**
 * AI Gateway LLM adapter factory: validates config + wires ops into the
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
  parseAigatewayLlmConfig,
  type AigatewayLlmConfig,
  type AigatewayLlmConfigInput,
} from './config.js';
import { listModelsOp } from './ops/listModels.js';
import { generateOp } from './ops/generate.js';
import { streamOp } from './ops/stream.js';

export interface AigatewayLlmCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  embeddings: boolean;
  runtime: boolean;
}

export interface AigatewayLlmAdapter extends LlmAdapter {
  readonly category: 'llm';
  readonly id: 'llm-aigateway';
  getCapabilities(): AigatewayLlmCapabilities;
}

const STATIC_CAPS: AigatewayLlmCapabilities = Object.freeze({
  streaming: true,
  tools: false,
  vision: false,
  embeddings: false,
  runtime: true,
});

export function createAigatewayLlmAdapter(
  input: AigatewayLlmConfigInput,
): AigatewayLlmAdapter {
  const cfg: AigatewayLlmConfig = parseAigatewayLlmConfig(input);
  const adapter: AigatewayLlmAdapter = {
    category: 'llm',
    id: 'llm-aigateway',
    listModels: (): Promise<LlmModel[]> => listModelsOp(cfg),
    generate: (prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult> =>
      generateOp(cfg, prompt, opts),
    stream: (prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk> =>
      streamOp(cfg, prompt, opts),
    getCapabilities: (): AigatewayLlmCapabilities => STATIC_CAPS,
  };
  return Object.freeze(adapter);
}
