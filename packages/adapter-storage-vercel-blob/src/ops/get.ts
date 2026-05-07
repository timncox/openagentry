/**
 * StorageAdapter.get — metadata fetch via SDK head().
 *
 * Returns null when the object does not exist (BlobNotFoundError).
 * All other errors are mapped to AgentryError via sdkErrorToBlobError.
 *
 * @module
 */

import type { StorageObject } from '@openagentry/core';
import { BlobNotFoundError, head as sdkHead, type HeadBlobResult } from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../config.js';
import { sdkErrorToBlobError } from '../errors.js';
import { validateKey } from '../pathname.js';

export async function getOp(
  cfg: VercelBlobStorageConfig,
  key: string,
): Promise<StorageObject | null> {
  validateKey(key, 'read');

  let result: HeadBlobResult;
  try {
    result = await sdkHead(key, { token: cfg.token });
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw sdkErrorToBlobError(err, 'read', key);
  }

  return {
    key,
    url: result.url,
    size: result.size,
    contentType: result.contentType,
    uploadedAt: result.uploadedAt.toISOString() as StorageObject['uploadedAt'],
  };
}
