/**
 * @vercel/blob mock factory backed by the shared in-memory store.
 *
 * Usage in a test file:
 *
 *   vi.mock('@vercel/blob', async () => {
 *     const { makeSdkMock } = await import('./conformance/sdk-mock.js');
 *     return makeSdkMock();
 *   });
 *
 * @module
 */

import {
  bytesFromBody,
  downloadUrlFor,
  getStore,
  nextEtag,
  urlFor,
  type StoredBlob,
} from './mock-store.js';

export async function makeSdkMock(): Promise<typeof import('@vercel/blob')> {
  const actual = await import('@vercel/blob');
  return {
    ...actual,
    put: async (
      pathname: string,
      body: unknown,
      opts: {
        access: 'public' | 'private';
        contentType?: string;
        cacheControlMaxAge?: number;
        allowOverwrite?: boolean;
        addRandomSuffix?: boolean;
        token?: string;
      },
    ) => {
      const store = getStore();
      if (!opts.allowOverwrite && store.has(pathname)) {
        // Mirror SDK behavior: throws if blob already exists and allowOverwrite is false.
        // Our adapter always sets allowOverwrite: true, so this should never fire in conformance.
        throw new actual.BlobError('Blob already exists');
      }
      const bytes = bytesFromBody(body);
      const contentType = opts.contentType ?? sniffContentType(pathname);
      const stored: StoredBlob = {
        body: bytes,
        access: opts.access,
        contentType,
        contentDisposition: `attachment; filename="${pathname.split('/').pop() ?? pathname}"`,
        uploadedAt: new Date(),
        cacheControlMaxAge: opts.cacheControlMaxAge ?? 30 * 24 * 60 * 60,
        etag: nextEtag(),
      };
      store.set(pathname, stored);
      return {
        pathname,
        contentType,
        contentDisposition: stored.contentDisposition,
        url: urlFor(stored, pathname),
        downloadUrl: downloadUrlFor(stored, pathname),
        etag: stored.etag,
      };
    },
    head: async (key: string, _opts?: { token?: string }) => {
      // SDK accepts URL or pathname; we accept both.
      const pathname = pathnameFromKey(key);
      const stored = getStore().get(pathname);
      if (stored === undefined) throw new actual.BlobNotFoundError();
      return {
        url: urlFor(stored, pathname),
        downloadUrl: downloadUrlFor(stored, pathname),
        pathname,
        contentType: stored.contentType,
        contentDisposition: stored.contentDisposition,
        size: stored.body.byteLength,
        uploadedAt: stored.uploadedAt,
        cacheControl: `max-age=${stored.cacheControlMaxAge}`,
      };
    },
    del: async (key: string | string[], _opts?: { token?: string }) => {
      const keys = Array.isArray(key) ? key : [key];
      const store = getStore();
      for (const k of keys) {
        store.delete(pathnameFromKey(k));
      }
    },
    list: async (opts?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
      token?: string;
    }) => {
      const store = getStore();
      const prefix = opts?.prefix ?? '';
      const blobs = Array.from(store.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, b]) => ({
          url: urlFor(b, k),
          downloadUrl: downloadUrlFor(b, k),
          pathname: k,
          size: b.body.byteLength,
          uploadedAt: b.uploadedAt,
          etag: b.etag,
        }));
      // Single-page response (we don't simulate pagination for conformance).
      return { blobs, hasMore: false };
    },
  };
}

function pathnameFromKey(key: string): string {
  try {
    const u = new URL(key);
    return decodeURIComponent(u.pathname.slice(1));
  } catch {
    return key; // already a pathname
  }
}

function sniffContentType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase();
  if (ext === undefined || ext === pathname) return 'application/octet-stream';
  const map: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    md: 'text/markdown',
  };
  return map[ext] ?? 'application/octet-stream';
}
