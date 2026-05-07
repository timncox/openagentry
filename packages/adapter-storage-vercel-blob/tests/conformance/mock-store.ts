/**
 * Stateful in-memory mock store for Vercel Blob conformance tests.
 *
 * The store is module-level state, so the SDK mock factory and MSW handlers
 * can both read/write the same Map. `resetStore()` clears it between tests.
 *
 * @module
 */

export interface StoredBlob {
  body: Uint8Array;
  access: 'public' | 'private';
  contentType: string;
  contentDisposition: string;
  uploadedAt: Date;
  cacheControlMaxAge: number;
  etag: string;
}

const store = new Map<string, StoredBlob>();
let etagCounter = 0;

export const STORE_ID = 'cnf12345';
export const TOKEN = 'vercel_blob_rw_TEST';
export const PUBLIC_HOST = `${STORE_ID}.public.blob.vercel-storage.com`;
export const PRIVATE_HOST = `${STORE_ID}.private.blob.vercel-storage.com`;

export function nextEtag(): string {
  etagCounter += 1;
  return `"${etagCounter.toString(16).padStart(8, '0')}"`;
}

export function urlFor(blob: StoredBlob, pathname: string): string {
  const host = blob.access === 'public' ? PUBLIC_HOST : PRIVATE_HOST;
  return `https://${host}/${pathname}`;
}

export function downloadUrlFor(blob: StoredBlob, pathname: string): string {
  return `${urlFor(blob, pathname)}?download=1`;
}

export function getStore(): Map<string, StoredBlob> {
  return store;
}

export function resetStore(): void {
  store.clear();
  etagCounter = 0;
}

export function bytesFromBody(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  // For Buffer (Node), Blob, ReadableStream, etc., handle as best-effort
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  // Last resort: try toString
  return new TextEncoder().encode(String(body));
}
