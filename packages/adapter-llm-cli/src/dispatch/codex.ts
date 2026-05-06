/**
 * codex CLI dispatch.
 *
 * Argv shape (subject to codex CLI evolution; verified in plan-stage):
 *   codex exec --model <id> <prompt>
 * codex doesn't have a stable system-prompt flag at this CLI version;
 * we prepend the system prompt to the user prompt with a delimiter.
 *
 * Streaming: codex emits text line-by-line on stdout. There's no usage
 * info reliably available, so parseFinalUsage returns undefined.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmModel, LlmStreamChunk } from '@openagentry/core';
import type { CliDispatch } from './index.js';

const CODEX_MODELS: LlmModel[] = [
  {
    id: 'gpt-5',
    label: 'OpenAI GPT-5',
    contextWindow: 200_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
  {
    id: 'gpt-4.1',
    label: 'OpenAI GPT-4.1',
    contextWindow: 128_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
];

const DEFAULT_MODEL = 'gpt-5';
const SYSTEM_DELIMITER = '\n\n=== SYSTEM ===\n';

export const codexDispatch: CliDispatch = {
  bin: 'codex',

  models(): LlmModel[] {
    return CODEX_MODELS;
  },

  buildArgv(prompt, opts) {
    const fullPrompt =
      opts.system !== undefined && opts.system.length > 0
        ? `${opts.system}${SYSTEM_DELIMITER}${prompt}`
        : prompt;
    return ['exec', '--model', opts.model ?? DEFAULT_MODEL, fullPrompt];
  },

  parseStreamChunk(line) {
    if (line.length === 0) return null;
    const chunk: LlmStreamChunk = { type: 'text', text: line };
    return chunk;
  },

  parseFinalUsage(_stdout, _stderr) {
    return undefined;
  },

  authErrorPattern: /run\s+codex\s+login|unauthorized|invalid\s+api\s+key|missing\s+openai_api_key/i,
};
