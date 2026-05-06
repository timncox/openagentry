/**
 * claude CLI dispatch.
 *
 * Argv shape (subject to claude CLI evolution; verified in plan-stage):
 *   claude --model <id> --output-format stream-json --append-system-prompt <s> -p <prompt>
 *
 * Streaming: stream-json emits one JSON object per line. Text chunks have
 * shape { type: 'content_block_delta', delta: { type: 'text_delta', text } }.
 * The final block has shape { type: 'result', usage: { input_tokens, output_tokens } }.
 *
 * @module
 */

import type {
  LlmGenerateOpts,
  LlmModel,
  LlmStreamChunk,
} from '@openagentry/core';
import type { CliDispatch } from './index.js';

const CLAUDE_MODELS: LlmModel[] = [
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    contextWindow: 200_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    capabilities: { tools: true, streaming: true, vision: true },
  },
];

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export const claudeDispatch: CliDispatch = {
  bin: 'claude',

  models(): LlmModel[] {
    return CLAUDE_MODELS;
  },

  buildArgv(prompt, opts) {
    const args: string[] = [
      '--output-format',
      'stream-json',
      '--model',
      opts.model ?? DEFAULT_MODEL,
    ];
    if (opts.system !== undefined && opts.system.length > 0) {
      args.push('--append-system-prompt', opts.system);
    }
    args.push('-p', prompt);
    return args;
  },

  parseStreamChunk(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if (parsed === null || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (obj['type'] === 'content_block_delta') {
      const delta = obj['delta'] as { type?: string; text?: string } | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        return { type: 'text', text: delta.text };
      }
    }
    if (obj['type'] === 'result') {
      const usage = obj['usage'] as
        | { input_tokens?: number; output_tokens?: number }
        | undefined;
      if (
        usage !== undefined &&
        typeof usage.input_tokens === 'number' &&
        typeof usage.output_tokens === 'number'
      ) {
        return {
          type: 'done',
          usage: {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
          },
        } satisfies LlmStreamChunk;
      }
      return { type: 'done' };
    }
    return null;
  },

  parseFinalUsage(stdout, _stderr) {
    // Walk lines from end; first line that's a JSON object with type:'result' wins.
    const lines = stdout.split('\n').reverse();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed['type'] === 'result') {
          const usage = parsed['usage'] as
            | { input_tokens?: number; output_tokens?: number }
            | undefined;
          if (
            usage !== undefined &&
            typeof usage.input_tokens === 'number' &&
            typeof usage.output_tokens === 'number'
          ) {
            return {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
            };
          }
        }
      } catch {
        // ignore malformed line, keep walking
      }
    }
    return undefined;
  },

  authErrorPattern: /run\s+claude\s+login|not\s+authenticated|invalid\s+api\s+key/i,
};
