/**
 * StorageAdapter.put — single-PUT upload via @vercel/blob SDK.
 *
 * @module
 */

import type { PutOpts, StorageObject } from '@openagentry/core';
import { put as sdkPut, type PutBlobResult, type PutCommandOptions } from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../config.js';
import { sdkErrorToBlobError } from '../errors.js';
import { parseCacheMaxAge, validateKey } from '../pathname.js';

function bodyByteLength(body: ArrayBuffer | Uint8Array | string): number {
  if (typeof body === 'string') return new TextEncoder().encode(body).length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  return body.byteLength;
}

export async function putOp(
  cfg: VercelBlobStorageConfig,
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  opts?: PutOpts,
): Promise<StorageObject> {
  validateKey(key, 'write');

  const access: 'public' | 'private' =
    opts?.public === true
      ? 'public'
      : opts?.public === false
        ? 'private'
        : cfg.defaultAccess;

  const cacheControlMaxAge =
    parseCacheMaxAge(opts?.cacheControl) ??
    (access === 'public' ? cfg.cacheMaxAgePublic : cfg.cacheMaxAgePrivate);

  const sdkOpts: PutCommandOptions = {
    access,
    token: cfg.token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge,
  };
  if (opts?.contentType !== undefined) {
    sdkOpts.contentType = opts.contentType;
  }
  // opts.meta has no analog in @vercel/blob; intentionally ignored.

  let result: PutBlobResult;
  try {
    result = await sdkPut(key, body, sdkOpts);
  } catch (err) {
    throw sdkErrorToBlobError(err, 'write', key);
  }

  return {
    key,
    url: result.url,
    size: bodyByteLength(body),
    contentType: result.contentType,
    uploadedAt: new Date().toISOString() as StorageObject['uploadedAt'],
  };
}
