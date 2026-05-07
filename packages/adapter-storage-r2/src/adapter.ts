/**
 * R2 storage adapter factory: validates config + wires ops through a single
 * SigV4 client into the StorageAdapter shape.
 *
 * @module
 */

import type { PutOpts, StorageAdapter, StorageObject } from '@openagentry/core';
import { parseR2StorageConfig, type R2StorageConfigInput } from './config.js';
import { createS3Client } from './s3-client.js';
import { putOp } from './ops/put.js';
import { getOp } from './ops/get.js';
import { deleteOp } from './ops/delete.js';
import { listOp } from './ops/list.js';

export interface R2StorageCapabilities {
  supportsPublic: boolean;
}

export interface R2StorageAdapter extends StorageAdapter {
  readonly category: 'storage';
  readonly id: 'storage-r2';
  getCapabilities(): R2StorageCapabilities;
}

export function createR2StorageAdapter(input: R2StorageConfigInput): R2StorageAdapter {
  const cfg = parseR2StorageConfig(input);
  const client = createS3Client(cfg);
  const adapter: R2StorageAdapter = {
    category: 'storage',
    id: 'storage-r2',
    put: (key: string, body: ArrayBuffer | Uint8Array | string, opts?: PutOpts): Promise<StorageObject> =>
      putOp(client, cfg, key, body, opts),
    get: (key: string): Promise<StorageObject | null> =>
      getOp(client, cfg, key),
    delete: (key: string): Promise<void> =>
      deleteOp(client, key),
    list: (prefix?: string): AsyncIterable<StorageObject> =>
      listOp(client, cfg, prefix),
    getCapabilities: (): R2StorageCapabilities => ({
      supportsPublic: cfg.publicBaseUrl !== undefined,
    }),
  };
  return Object.freeze(adapter);
}
