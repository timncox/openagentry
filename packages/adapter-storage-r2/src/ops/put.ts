/**
 * StorageAdapter.put — upload an object to R2 via S3 PUT.
 *
 * @module
 */

import type { PutOpts, StorageObject } from '@openagentry/core';
import type { R2StorageConfig } from '../config.js';
import type { SignedFetch } from '../s3-client.js';
import { r2Error, R2_ERROR_CODES, httpToR2Error, networkErr } from '../errors.js';
import { sniffFromKey, defaultCacheControl } from '../content-type.js';
import { publicUrl, presignGetUrl } from '../url.js';
import { validateKey } from '../validate-key.js';

function bodyByteLength(body: ArrayBuffer | Uint8Array | string): number {
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (body instanceof ArrayBuffer) return body.byteLength;
  return body.byteLength;
}

export async function putOp(
  client: SignedFetch,
  cfg: R2StorageConfig,
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  opts?: PutOpts,
): Promise<StorageObject> {
  validateKey(key, 'write');

  const isPublic = opts?.public === true;
  if (isPublic && cfg.publicBaseUrl === undefined) {
    throw r2Error({
      code: R2_ERROR_CODES.PUBLIC_NOT_CONFIGURED,
      message: 'put({ public: true }) requires publicBaseUrl in adapter config',
      phase: 'write',
      suggestedFix:
        'Set publicBaseUrl in the adapter config (your custom domain or pub-XXX.r2.dev) to upload objects with public:true.',
    });
  }

  const contentType = opts?.contentType ?? sniffFromKey(key) ?? 'application/octet-stream';
  const cacheControl = opts?.cacheControl ?? defaultCacheControl(isPublic);

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  };
  for (const [k, v] of Object.entries(opts?.meta ?? {})) {
    const lower = k.toLowerCase();
    if (lower === 'oa-public') continue; // reserved internal marker
    headers[`x-amz-meta-${lower}`] = v;
  }
  if (isPublic) headers['x-amz-meta-oa-public'] = '1';

  let response: Response;
  try {
    response = await client.request({ method: 'PUT', key, body: body as BodyInit, headers });
  } catch (err) {
    throw networkErr(err, 'write', key);
  }
  if (!response.ok) {
    throw await httpToR2Error(response, 'write', key);
  }

  const size = bodyByteLength(body);
  let url: string;
  if (isPublic) {
    // cfg.publicBaseUrl is narrowed to string by the guard above (we threw if undefined)
    url = publicUrl(cfg.publicBaseUrl!, key);
  } else {
    url = await presignGetUrl(client, key, cfg.presignTtlSeconds);
  }

  return {
    key,
    url,
    size,
    contentType,
    uploadedAt: new Date().toISOString() as StorageObject['uploadedAt'],
  };
}
