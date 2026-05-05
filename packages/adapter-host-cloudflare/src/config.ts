/**
 * Cloudflare adapter configuration. Parsed at adapter construction time.
 *
 * @module
 */

import { z } from 'zod';

export const cloudflareConfigSchema = z
  .object({
    apiToken: z.string().trim().min(1, 'apiToken must be a non-empty string'),
    accountId: z
      .string()
      .regex(/^[a-f0-9]{32}$/, 'accountId must be a 32-char lowercase hex string'),
    apiBase: z.string().url().default('https://api.cloudflare.com/client/v4'),
  })
  .strict();

export type CloudflareConfig = z.infer<typeof cloudflareConfigSchema>;

export function parseCloudflareConfig(input: unknown): CloudflareConfig {
  return cloudflareConfigSchema.parse(input);
}
