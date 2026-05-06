/**
 * gemini CLI dispatch.
 *
 * Argv shape (subject to gemini CLI evolution; verified in plan-stage):
 *   gemini --model <id> --system-instruction <s> -p <prompt>
 *
 * Streaming: line-buffered stdout. No reliable usage protocol;
 * parseFinalUsage returns undefined.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmModel, LlmStreamChunk } from '@openagentry/core';
import type { CliDispatch } from './index.js';

const GEMINI_MODELS: LlmModel[] = [
  {
    id: 'gemini-2.5-pro',
    label: 'Google Gemini 2.5 Pro',
    contextWindow: 1_000_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Google Gemini 2.5 Flash',
    contextWindow: 1_000_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
];

const DEFAULT_MODEL = 'gemini-2.5-pro';

export const geminiDispatch: CliDispatch = {
  bin: 'gemini',

  models(): LlmModel[] {
    return GEMINI_MODELS;
  },

  buildArgv(prompt, opts) {
    const args: string[] = ['--model', opts.model ?? DEFAULT_MODEL];
    if (opts.system !== undefined && opts.system.length > 0) {
      args.push('--system-instruction', opts.system);
    }
    args.push('-p', prompt);
    return args;
  },

  parseStreamChunk(line) {
    if (line.length === 0) return null;
    const chunk: LlmStreamChunk = { type: 'text', text: line };
    return chunk;
  },

  parseFinalUsage(_stdout, _stderr) {
    return undefined;
  },

  authErrorPattern: /run\s+gemini\s+auth|unauthorized|invalid\s+api\s+key|missing\s+google_api_key/i,
};
