/**
 * StorageAdapter.delete — idempotent DELETE.
 *
 * @module
 */

import type { SignedFetch } from '../s3-client.js';
import { httpToR2Error, networkErr } from '../errors.js';
import { validateKey } from '../validate-key.js';

export async function deleteOp(client: SignedFetch, key: string): Promise<void> {
  validateKey(key, 'delete');

  let response: Response;
  try {
    response = await client.request({ method: 'DELETE', key });
  } catch (err) {
    throw networkErr(err, 'delete', key);
  }
  // S3 DELETE is idempotent — 204 always; 404 also acceptable.
  if (!response.ok && response.status !== 404) {
    throw await httpToR2Error(response, 'delete', key);
  }
}
