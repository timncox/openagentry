/**
 * Neon adapter configuration. Trims + validates the API key and provides
 * sensible defaults for apiBase and defaultRegion.
 *
 * @module
 */

import { z } from 'zod';

export const neonConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1, 'apiKey must be a non-empty Neon API key'),
    apiBase: z
      .string()
      .url('apiBase must be a valid URL')
      .default('https://console.neon.tech/api/v2'),
    defaultRegion: z.string().min(1).default('aws-us-east-2'),
  })
  .strict();

export type NeonConfig = z.infer<typeof neonConfigSchema>;

export function parseNeonConfig(input: unknown): NeonConfig {
  return neonConfigSchema.parse(input);
}
