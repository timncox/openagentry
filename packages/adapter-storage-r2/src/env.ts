/**
 * Read R2 adapter configuration from environment variables.
 *
 * @module
 */

import { parseR2StorageConfig, type R2StorageConfig } from './config.js';

const REQUIRED = ['OA_R2_ACCOUNT_ID', 'OA_R2_ACCESS_KEY_ID', 'OA_R2_SECRET_ACCESS_KEY', 'OA_R2_BUCKET'] as const;

export type EnvReadResult =
  | { kind: 'ok'; config: R2StorageConfig }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'invalid'; error: unknown };

export function readEnvConfig(env: Record<string, string | undefined>): EnvReadResult {
  const missing = REQUIRED.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    return { kind: 'missing', missing };
  }
  const ttlRaw = env.OA_R2_PRESIGN_TTL;
  const presignTtlSeconds = ttlRaw === undefined || ttlRaw === '' ? undefined : Number(ttlRaw);
  try {
    const input: Record<string, unknown> = {
      accountId: env.OA_R2_ACCOUNT_ID!,
      accessKeyId: env.OA_R2_ACCESS_KEY_ID!,
      secretAccessKey: env.OA_R2_SECRET_ACCESS_KEY!,
      bucket: env.OA_R2_BUCKET!,
    };
    if (env.OA_R2_PUBLIC_BASE_URL !== undefined) input.publicBaseUrl = env.OA_R2_PUBLIC_BASE_URL;
    if (presignTtlSeconds !== undefined) input.presignTtlSeconds = presignTtlSeconds;
    if (env.OA_R2_ENDPOINT !== undefined) input.endpoint = env.OA_R2_ENDPOINT;
    const config = parseR2StorageConfig(input);
    return { kind: 'ok', config };
  } catch (err) {
    return { kind: 'invalid', error: err };
  }
}
