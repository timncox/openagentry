/**
 * Read Vercel Blob adapter configuration from environment variables.
 *
 * @module
 */

import { parseVercelBlobStorageConfig, type VercelBlobStorageConfig } from './config.js';

const REQUIRED = ['OA_VERCEL_BLOB_TOKEN'] as const;

export type EnvReadResult =
  | { kind: 'ok'; config: VercelBlobStorageConfig }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'invalid'; error: unknown };

function parseOptionalInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  // Pass through NaN/non-finite; zod will reject with a clear schema error.
  return Number(raw);
}

export function readEnvConfig(env: Record<string, string | undefined>): EnvReadResult {
  const missing = REQUIRED.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    return { kind: 'missing', missing };
  }
  try {
    const input: Record<string, unknown> = {
      token: env.OA_VERCEL_BLOB_TOKEN!,
    };
    if (env.OA_VERCEL_BLOB_DEFAULT_ACCESS !== undefined && env.OA_VERCEL_BLOB_DEFAULT_ACCESS !== '') {
      input.defaultAccess = env.OA_VERCEL_BLOB_DEFAULT_ACCESS;
    }
    const pub = parseOptionalInt(env.OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC);
    if (pub !== undefined) input.cacheMaxAgePublic = pub;
    const priv = parseOptionalInt(env.OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE);
    if (priv !== undefined) input.cacheMaxAgePrivate = priv;

    const config = parseVercelBlobStorageConfig(input);
    return { kind: 'ok', config };
  } catch (err) {
    return { kind: 'invalid', error: err };
  }
}
