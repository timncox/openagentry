/**
 * Zod-validated configuration for the OpenRouter LLM adapter.
 *
 * Optional fields with defaults use `.default(...)` so the inferred output
 * type has them as non-optional (no `?? fallback` guards needed in op code).
 *
 * @module
 */

import { z } from 'zod';

export const openrouterLlmConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1, 'apiKey must be a non-empty string'),
    defaultModel: z.string().trim().min(1).optional(),
    baseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
    appUrl: z.string().url().optional(),
    appTitle: z.string().trim().min(1).optional(),
  })
  .strict();

export type OpenrouterLlmConfigInput = z.input<typeof openrouterLlmConfigSchema>;
export type OpenrouterLlmConfig = z.infer<typeof openrouterLlmConfigSchema>;

export function parseOpenrouterLlmConfig(input: unknown): OpenrouterLlmConfig {
  return openrouterLlmConfigSchema.parse(input);
}
