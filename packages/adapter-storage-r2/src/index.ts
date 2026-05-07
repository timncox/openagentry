/**
 * @openagentry/adapter-storage-r2 — public exports + lazy default export
 * resolved from OA_R2_* env vars.
 *
 * @module
 */

import type { PutOpts, StorageObject } from '@openagentry/core';
import { createR2StorageAdapter, type R2StorageAdapter, type R2StorageCapabilities } from './adapter.js';
import { readEnvConfig } from './env.js';
import { r2Error, R2_ERROR_CODES } from './errors.js';

export { createR2StorageAdapter };
export type { R2StorageAdapter, R2StorageCapabilities };
export {
  parseR2StorageConfig,
  r2StorageConfigSchema,
  type R2StorageConfig,
  type R2StorageConfigInput,
} from './config.js';
export { ADAPTER_ID, R2_ERROR_CODES, type R2ErrorCode } from './errors.js';

let cached: R2StorageAdapter | undefined;

function buildFromEnv(): R2StorageAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (result.kind === 'missing') {
    throw r2Error({
      code: R2_ERROR_CODES.CONFIG_INVALID,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      suggestedFix: `Set ${result.missing.join(', ')} in your environment, or pass a config to createR2StorageAdapter() directly.`,
    });
  }
  if (result.kind === 'invalid') {
    const cause = result.error instanceof Error ? result.error.message : String(result.error);
    throw r2Error({
      code: R2_ERROR_CODES.CONFIG_INVALID,
      message: `OA_R2_* env vars failed validation: ${cause}`,
      phase: 'init',
      suggestedFix:
        'Check your env vars match the R2StorageConfig schema (32-char hex accountId, valid bucket name, valid URL for publicBaseUrl).',
      cause: result.error,
    });
  }
  cached = createR2StorageAdapter(result.config);
  return cached;
}

const lazyAdapter: R2StorageAdapter = Object.freeze({
  category: 'storage',
  id: 'storage-r2',
  put: (key: string, body: ArrayBuffer | Uint8Array | string, opts?: PutOpts): Promise<StorageObject> =>
    buildFromEnv().put(key, body, opts),
  get: (key: string): Promise<StorageObject | null> =>
    buildFromEnv().get(key),
  delete: (key: string): Promise<void> =>
    buildFromEnv().delete(key),
  list: (prefix?: string): AsyncIterable<StorageObject> =>
    buildFromEnv().list(prefix),
  getCapabilities: (): R2StorageCapabilities => {
    // Capability inquiry should not throw on missing env — return false.
    try {
      return buildFromEnv().getCapabilities();
    } catch {
      return { supportsPublic: false };
    }
  },
});

export default lazyAdapter;
