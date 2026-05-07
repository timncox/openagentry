/**
 * Vercel Blob storage adapter factory: validates config + wires ops into
 * the StorageAdapter shape.
 *
 * @module
 */

import type { PutOpts, StorageAdapter, StorageObject } from '@openagentry/core';
import {
  parseVercelBlobStorageConfig,
  type VercelBlobStorageConfig,
  type VercelBlobStorageConfigInput,
} from './config.js';
import { putOp } from './ops/put.js';
import { getOp } from './ops/get.js';
import { deleteOp } from './ops/delete.js';
import { listOp } from './ops/list.js';

export interface VercelBlobStorageCapabilities {
  /** Vercel Blob always supports public access (per-blob via `access: 'public'`). */
  supportsPublic: boolean;
  /** PUT-time access default — what `opts.public === undefined` resolves to. */
  defaultAccess: 'public' | 'private';
}

export interface VercelBlobStorageAdapter extends StorageAdapter {
  readonly category: 'storage';
  readonly id: 'storage-vercel-blob';
  getCapabilities(): VercelBlobStorageCapabilities;
}

export function createVercelBlobStorageAdapter(
  input: VercelBlobStorageConfigInput,
): VercelBlobStorageAdapter {
  const cfg: VercelBlobStorageConfig = parseVercelBlobStorageConfig(input);
  const adapter: VercelBlobStorageAdapter = {
    category: 'storage',
    id: 'storage-vercel-blob',
    put: (key: string, body: ArrayBuffer | Uint8Array | string, opts?: PutOpts): Promise<StorageObject> =>
      putOp(cfg, key, body, opts),
    get: (key: string): Promise<StorageObject | null> => getOp(cfg, key),
    delete: (key: string): Promise<void> => deleteOp(cfg, key),
    list: (prefix?: string): AsyncIterable<StorageObject> => listOp(cfg, prefix),
    getCapabilities: (): VercelBlobStorageCapabilities => ({
      supportsPublic: true,
      defaultAccess: cfg.defaultAccess,
    }),
  };
  return Object.freeze(adapter);
}
