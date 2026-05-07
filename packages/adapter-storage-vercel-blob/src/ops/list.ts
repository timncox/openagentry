/**
 * StorageAdapter.list — paginated AsyncIterable via SDK list().
 *
 * Yields StorageObjects one page at a time, following cursor pagination.
 * Per-blob contentType is intentionally omitted: the Vercel Blob list
 * response does not include it (only head() returns contentType).
 *
 * @module
 */

import type { StorageObject } from '@openagentry/core';
import { list as sdkList, type ListBlobResult, type ListCommandOptions } from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../config.js';
import { sdkErrorToBlobError } from '../errors.js';

export async function* listOp(
  cfg: VercelBlobStorageConfig,
  prefix?: string,
): AsyncIterable<StorageObject> {
  let cursor: string | undefined;
  do {
    const opts: ListCommandOptions = { token: cfg.token, limit: 1000 };
    if (prefix !== undefined) opts.prefix = prefix;
    if (cursor !== undefined) opts.cursor = cursor;

    let result: ListBlobResult;
    try {
      result = await sdkList(opts);
    } catch (err) {
      throw sdkErrorToBlobError(err, 'list', prefix);
    }

    for (const blobItem of result.blobs) {
      const uploadedAtIso =
        blobItem.uploadedAt instanceof Date
          ? blobItem.uploadedAt.toISOString()
          : (blobItem.uploadedAt as unknown as string);
      yield {
        key: blobItem.pathname,
        url: blobItem.url,
        size: blobItem.size,
        uploadedAt: uploadedAtIso as StorageObject['uploadedAt'],
        // contentType is not included in Vercel Blob list responses — omit.
      };
    }

    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor !== undefined);
}
