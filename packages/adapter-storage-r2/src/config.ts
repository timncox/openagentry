/**
 * Zod-validated configuration for the R2 storage adapter.
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
      .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'bucket must be lowercase alphanumeric with optional internal hyphens, 3-63 chars'),
    publicBaseUrl: z.string().url().optional(),
    presignTtlSeconds: z.number().int().min(60).max(604800).optional(),
    endpoint: z.string().url().optional(),
    region: z.string().optional(),
  })
  .strict();

export type R2StorageConfigInput = z.input<typeof r2StorageConfigSchema>;
export type R2StorageConfigParsed = z.output<typeof r2StorageConfigSchema>;

export interface R2StorageConfig extends Required<Pick<R2StorageConfigParsed, 'accountId' | 'accessKeyId' | 'secretAccessKey' | 'bucket' | 'region' | 'endpoint' | 'presignTtlSeconds'>> {
  publicBaseUrl?: string;
}

export function parseR2StorageConfig(input: unknown): R2StorageConfig {
  const parsed = r2StorageConfigSchema.parse(input);
  return {
    accountId: parsed.accountId,
    accessKeyId: parsed.accessKeyId,
    secretAccessKey: parsed.secretAccessKey,
    bucket: parsed.bucket,
    region: parsed.region ?? 'auto',
    endpoint: parsed.endpoint ?? `https://${parsed.accountId}.r2.cloudflarestorage.com`,
    presignTtlSeconds: parsed.presignTtlSeconds ?? 3600,
    ...(parsed.publicBaseUrl !== undefined && { publicBaseUrl: parsed.publicBaseUrl }),
  };
}
