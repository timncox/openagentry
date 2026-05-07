/**
 * Zod-validated configuration for the R2 storage adapter.
 *
 * Optional fields with a sensible runtime default (region, endpoint,
 * presignTtlSeconds) use `.default(...)` so that `R2StorageConfig` —
 * derived via `z.infer<typeof r2StorageConfigSchema>` — has them typed as
 * non-optional. That removes the need for `?? fallback` guards in op files.
 *
 * @module
 */

import { z } from 'zod';

export const r2StorageConfigSchema = z
  .object({
    accountId: z
      .string()
      .regex(/^[a-f0-9]{32}$/, 'accountId must be 32-char lowercase hex (Cloudflare account ID)'),
    accessKeyId: z.string().trim().min(1, 'accessKeyId must be a non-empty string'),
    secretAccessKey: z.string().trim().min(1, 'secretAccessKey must be a non-empty string'),
    bucket: z
      .string()
      .min(3)
      .max(63)
      .regex(
        /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/,
        'bucket must be lowercase alphanumeric with optional internal hyphens (no consecutive hyphens), 3-63 chars',
      ),
    publicBaseUrl: z.string().url().optional(),
    presignTtlSeconds: z.number().int().min(60).max(604800).default(3600),
    endpoint: z.string().url().optional(),
    region: z.string().default('auto'),
  })
  .strict();

export type R2StorageConfigInput = z.input<typeof r2StorageConfigSchema>;

/**
 * Fully-resolved R2 adapter configuration. All fields are required (no
 * `undefined`), including `endpoint` which is derived from `accountId` when
 * not supplied by the caller.
 */
export interface R2StorageConfig extends z.infer<typeof r2StorageConfigSchema> {
  /** Always a valid URL; defaults to `https://<accountId>.r2.cloudflarestorage.com`. */
  endpoint: string;
}

export function parseR2StorageConfig(input: unknown): R2StorageConfig {
  const parsed = r2StorageConfigSchema.parse(input);
  return {
    ...parsed,
    endpoint: parsed.endpoint ?? `https://${parsed.accountId}.r2.cloudflarestorage.com`,
  } as R2StorageConfig;
}

