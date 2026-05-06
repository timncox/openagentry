/**
 * Zod-validated LlmCliConfig + parser.
 *
 * `exec` is typed as a SpawnFn function (defined in src/exec.ts); the
 * schema uses z.custom because functions are not zod's strong suit and
 * we don't need runtime structural validation — TypeScript catches bad
 * shapes at the call site.
 *
 * @module
 */

import { z } from 'zod';
import { AgentryError } from '@openagentry/core';
import { ADAPTER_ID, LLM_CLI_ERROR_CODES } from './errors.js';
import type { SpawnFn } from './exec.js';

export const llmCliConfigSchema = z
  .object({
    cli: z.enum(['claude', 'codex', 'gemini']),
    binPath: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    env: z.record(z.string()).optional(),
    exec: z.custom<SpawnFn>().optional(),
  })
  .strict();

export type LlmCliConfig = z.infer<typeof llmCliConfigSchema>;

/** Parse + validate config, wrapping zod errors as AgentryError. */
export function parseLlmCliConfig(input: unknown): LlmCliConfig {
  const result = llmCliConfigSchema.safeParse(input);
  if (!result.success) {
    throw new AgentryError({
      code: LLM_CLI_ERROR_CODES.SCHEMA,
      message: `[${LLM_CLI_ERROR_CODES.SCHEMA}] Invalid LlmCliConfig: ${result.error.message}`,
      phase: 'init',
      adapter: ADAPTER_ID,
      suggestedFix:
        "Pass an object with required 'cli' field set to 'claude' | 'codex' | 'gemini'.",
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}
