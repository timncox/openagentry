/**
 * claude CLI dispatch.
 *
 * Argv shape:
 *   claude --output-format stream-json --verbose --model <id>
 *          [--append-system-prompt <s>] -p <prompt>
 *
 * Streaming (real Claude Code CLI format, verified 2026-05):
 *   Each line is a JSON object. Text arrives as:
 *     { type: 'assistant', message: { content: [{ type: 'text', text }] } }
 *   The final line is:
 *     { type: 'result', subtype: 'success', result: '<text>',
 *       usage: { input_tokens, output_tokens, ... } }
 *
 * Note: the CLI does NOT emit content_block_delta events — those are the
 * raw Anthropic API SSE format, not the Claude Code stream-json format.
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
      '--verbose',
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

    // Real Claude Code CLI: text arrives in assistant events.
    if (obj['type'] === 'assistant') {
      const message = obj['message'] as
        | { content?: Array<{ type?: string; text?: string }> }
        | undefined;
      if (Array.isArray(message?.content)) {
        const texts = message.content
          .filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text as string)
          .join('');
        if (texts.length > 0) return { type: 'text', text: texts };
      }
      return null;
    }

    // Legacy / stub format: content_block_delta (Anthropic raw SSE shape).
    if (obj['type'] === 'content_block_delta') {
      const delta = obj['delta'] as { type?: string; text?: string } | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        return { type: 'text', text: delta.text };
      }
    }

    // result event signals end of stream; carries usage and final text.
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

  authErrorPattern: /run\s+\/login|not\s+logged\s+in|run\s+claude\s+login|not\s+authenticated|invalid\s+api\s+key/i,
};
