/**
 * Zod-validated configuration for the Vercel AI Gateway LLM adapter.
 *
 * Optional fields with sensible runtime defaults use `.default(...)` so that
 * the inferred output type has them as non-optional. That removes the need
 * for `?? fallback` guards in op files (closes Plan J deferred-followup #2).
 *
 * @module
 */

import { z } from 'zod';

export const aigatewayLlmConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1, 'apiKey must be a non-empty string'),
    defaultModel: z.string().trim().min(1).optional(),
    baseUrl: z.string().url().default('https://ai-gateway.vercel.sh/v1'),
  })
  .strict();

export type AigatewayLlmConfigInput = z.input<typeof aigatewayLlmConfigSchema>;
export type AigatewayLlmConfig = z.infer<typeof aigatewayLlmConfigSchema>;

export function parseAigatewayLlmConfig(input: unknown): AigatewayLlmConfig {
  return aigatewayLlmConfigSchema.parse(input);
}
