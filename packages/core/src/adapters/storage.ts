/**
 * StorageAdapter — object storage (S3, R2, Vercel Blob, GCS, etc.).
 *
 * @module
 */

import type { IsoTimestamp } from '../types.js';

export interface StorageObject {
  key: string;
  url: string;
  size: number;
  contentType?: string;
  uploadedAt: IsoTimestamp;
}

export interface PutOpts {
  contentType?: string;
  /** Whether the object is publicly accessible by URL. Default: false. */
  public?: boolean;
  /** Cache-Control header value. */
  cacheControl?: string;
  meta?: Record<string, string>;
}

export interface StorageAdapter {
  readonly category: 'storage';
  readonly id: string;

  put(
    key: string,
    body: ArrayBuffer | Uint8Array | string,
    opts?: PutOpts
  ): Promise<StorageObject>;

  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): AsyncIterable<StorageObject>;
}
