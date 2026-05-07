/**
 * URL synthesis: public URLs (caller-configured base + key) and presigned
 * GET URLs (delegated to the SigV4 signer in s3-client).
 *
 * @module
 */

import type { SignedFetch } from './s3-client.js';

function encodeKey(key: string): string {
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export function publicUrl(publicBaseUrl: string, key: string): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  const k = key.replace(/^\//, '');
  return `${base}/${encodeKey(k)}`;
}

export async function presignGetUrl(client: SignedFetch, key: string, ttlSeconds: number): Promise<string> {
  return client.presignGet(key, ttlSeconds);
}
