/**
 * StorageAdapter.delete — single-pathname delete via SDK del().
 *
 * The SDK's del() is documented to NOT throw on missing keys (idempotent).
 *
 * @module
 */

import { del as sdkDel } from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../config.js';
import { sdkErrorToBlobError } from '../errors.js';
import { validateKey } from '../pathname.js';

export async function deleteOp(
  cfg: VercelBlobStorageConfig,
  key: string,
): Promise<void> {
  validateKey(key, 'delete');
  try {
    await sdkDel(key, { token: cfg.token });
  } catch (err) {
    throw sdkErrorToBlobError(err, 'delete', key);
  }
}
