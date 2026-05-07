/**
 * @openagentry/adapter-storage-vercel-blob — public exports + lazy default
 * export resolved from OA_VERCEL_BLOB_* env vars.
 *
 * @module
 */

import type { PutOpts, StorageObject } from '@openagentry/core';
import {
  createVercelBlobStorageAdapter,
  type VercelBlobStorageAdapter,
  type VercelBlobStorageCapabilities,
} from './adapter.js';
import { readEnvConfig } from './env.js';
import { vercelBlobError, VERCEL_BLOB_ERROR_CODES } from './errors.js';

export const ADAPTER_VERSION = '0.1.0-alpha.0' as const;

export { createVercelBlobStorageAdapter };
export type { VercelBlobStorageAdapter, VercelBlobStorageCapabilities };
export {
  parseVercelBlobStorageConfig,
  vercelBlobStorageConfigSchema,
  type VercelBlobStorageConfig,
  type VercelBlobStorageConfigInput,
} from './config.js';
export {
  ADAPTER_ID,
  VERCEL_BLOB_ERROR_CODES,
  type VercelBlobErrorCode,
} from './errors.js';

let cached: VercelBlobStorageAdapter | undefined;

function buildFromEnv(): VercelBlobStorageAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (result.kind === 'missing') {
    throw vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.CONFIG_INVALID,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      suggestedFix: `Set ${result.missing.join(', ')} in your environment, or pass a config to createVercelBlobStorageAdapter() directly.`,
    });
  }
  if (result.kind === 'invalid') {
    const cause = result.error instanceof Error ? result.error.message : String(result.error);
    throw vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.CONFIG_INVALID,
      message: `OA_VERCEL_BLOB_* env vars failed validation: ${cause}`,
      phase: 'init',
      suggestedFix:
        'Check OA_VERCEL_BLOB_DEFAULT_ACCESS is "public" or "private", and cache-max-age values are positive integers.',
      cause: result.error,
    });
  }
  cached = createVercelBlobStorageAdapter(result.config);
  return cached;
}

// Lazy adapter: synchronous buildFromEnv() throws are wrapped as rejected
// promises by `async` on put/get/delete (call sites always `await`).
// `list` returns AsyncIterable, not a Promise, so it stays a bare arrow
// — sync throws there are caught by callers' for-await loops.
const lazyAdapter: VercelBlobStorageAdapter = Object.freeze({
  category: 'storage',
  id: 'storage-vercel-blob',
  put: async (key: string, body: ArrayBuffer | Uint8Array | string, opts?: PutOpts): Promise<StorageObject> =>
    buildFromEnv().put(key, body, opts),
  get: async (key: string): Promise<StorageObject | null> => buildFromEnv().get(key),
  delete: async (key: string): Promise<void> => buildFromEnv().delete(key),
  list: (prefix?: string): AsyncIterable<StorageObject> => buildFromEnv().list(prefix),
  getCapabilities: (): VercelBlobStorageCapabilities => {
    // Capability inquiry should not throw on missing env — return a permissive default.
    try {
      return buildFromEnv().getCapabilities();
    } catch {
      return { supportsPublic: true, defaultAccess: 'private' };
    }
  },
});

export default lazyAdapter;
