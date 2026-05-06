/**
 * createLlmCliAdapter — assembles an LlmAdapter from a config object.
 *
 * The returned object satisfies the LlmAdapter contract (category 'llm',
 * id 'llm-cli', listModels/generate/stream) and is frozen so consumers
 * can't mutate it.
 *
 * @module
 */

import type {
  LlmAdapter,
  LlmGenerateOpts,
  LlmGenerateResult,
  LlmStreamChunk,
} from '@openagentry/core';
import { parseLlmCliConfig, type LlmCliConfig } from './config.js';
import { getDispatch } from './dispatch/index.js';
import { defaultSpawn, type SpawnFn } from './exec.js';
import { listModels } from './ops/list-models.js';
import { generate } from './ops/generate.js';
import { stream } from './ops/stream.js';

export interface LlmCliAdapter extends LlmAdapter {
  readonly category: 'llm';
  readonly id: 'llm-cli';
}

export function createLlmCliAdapter(input: unknown): LlmCliAdapter {
  const config: LlmCliConfig = parseLlmCliConfig(input);
  const dispatch = getDispatch(config.cli);
  const spawnFn: SpawnFn = config.exec ?? defaultSpawn;
  const ctx = { dispatch, config, spawn: spawnFn };

  const adapter: LlmCliAdapter = {
    category: 'llm',
    id: 'llm-cli',
    async listModels() {
      return listModels(dispatch);
    },
    async generate(prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult> {
      return generate(ctx, prompt, opts ?? {});
    },
    stream(prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk> {
      return stream(ctx, prompt, opts ?? {});
    },
  };

  return Object.freeze(adapter);
}
