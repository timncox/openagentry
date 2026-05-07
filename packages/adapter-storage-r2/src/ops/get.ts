/**
 * StorageAdapter.get — HEAD-based metadata fetch + URL synthesis.
 *
 * @module
 */

import type { StorageObject } from '@openagentry/core';
import type { R2StorageConfig } from '../config.js';
import type { SignedFetch } from '../s3-client.js';
import { httpToR2Error, networkErr } from '../errors.js';
import { publicUrl, presignGetUrl } from '../url.js';
import { validateKey } from '../validate-key.js';

export async function getOp(
  client: SignedFetch,
  cfg: R2StorageConfig,
  key: string,
): Promise<StorageObject | null> {
  validateKey(key, 'read');

  let response: Response;
  try {
    response = await client.request({ method: 'HEAD', key });
  } catch (err) {
    throw networkErr(err, 'read', key);
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw await httpToR2Error(response, 'read', key);
  }

  const sizeHeader = response.headers.get('content-length');
  const size = sizeHeader !== null ? Number(sizeHeader) : 0;
  const contentType = response.headers.get('content-type') ?? undefined;
  const lastModified = response.headers.get('last-modified');
  const isPublic = response.headers.get('x-amz-meta-oa-public') === '1';

  const uploadedAt = lastModified !== null
    ? new Date(lastModified).toISOString()
    : new Date().toISOString();

  const url = isPublic && cfg.publicBaseUrl !== undefined
    ? publicUrl(cfg.publicBaseUrl, key)
    : await presignGetUrl(client, key, cfg.presignTtlSeconds ?? 3600);

  return {
    key,
    url,
    size,
    ...(contentType !== undefined && { contentType }),
    uploadedAt: uploadedAt as StorageObject['uploadedAt'],
  };
}
