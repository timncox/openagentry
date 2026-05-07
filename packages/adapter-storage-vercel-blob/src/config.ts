/**
 * Zod-validated configuration for the Vercel Blob storage adapter.
 *
 * Optional fields with sensible runtime defaults use `.default(...)` so that
 * the inferred output type has them as non-optional. That removes the need
 * for `?? fallback` guards in op files (closes Plan J deferred-followup #2).
 *
 * @module
 */

import { z } from 'zod';

export const vercelBlobStorageConfigSchema = z
  .object({
    token: z.string().trim().min(1, 'token must be a non-empty string'),
    defaultAccess: z.enum(['public', 'private']).default('private'),
    cacheMaxAgePublic: z.number().int().positive().default(31_536_000),
    cacheMaxAgePrivate: z.number().int().positive().default(3_600),
  })
  .strict();

export type VercelBlobStorageConfigInput = z.input<typeof vercelBlobStorageConfigSchema>;
export type VercelBlobStorageConfig = z.infer<typeof vercelBlobStorageConfigSchema>;

export function parseVercelBlobStorageConfig(input: unknown): VercelBlobStorageConfig {
  return vercelBlobStorageConfigSchema.parse(input);
}
