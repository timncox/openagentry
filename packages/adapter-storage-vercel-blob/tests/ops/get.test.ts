import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BlobAccessError,
  BlobNotFoundError,
} from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../../src/config.js';

// Mock the SDK head function before importing our op
vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    head: vi.fn(),
  };
});

const { head: sdkHead } = await import('@vercel/blob');
const { getOp } = await import('../../src/ops/get.js');

const cfg: VercelBlobStorageConfig = {
  token: 'vercel_blob_rw_TOKEN',
  defaultAccess: 'private',
  cacheMaxAgePublic: 31_536_000,
  cacheMaxAgePrivate: 3_600,
};

const mockHead = vi.mocked(sdkHead);

beforeEach(() => {
  mockHead.mockReset();
});

describe('getOp', () => {
  it('returns a StorageObject for a found pathname', async () => {
    const uploadedAt = new Date('2026-05-07T12:00:00Z');
    mockHead.mockResolvedValue({
      url: 'https://cnf12345.private.blob.vercel-storage.com/hello.txt',
      downloadUrl: 'https://cnf12345.private.blob.vercel-storage.com/hello.txt?download=1',
      pathname: 'hello.txt',
      contentType: 'text/plain',
      contentDisposition: 'attachment; filename="hello.txt"',
      size: 5,
      uploadedAt,
      cacheControl: 'public, max-age=31536000',
      etag: '"abc"',
    });
    const out = await getOp(cfg, 'hello.txt');
    expect(out).not.toBeNull();
    expect(out!.key).toBe('hello.txt');
    expect(out!.size).toBe(5);
    expect(out!.contentType).toBe('text/plain');
    expect(out!.uploadedAt).toBe(uploadedAt.toISOString());
    expect(out!.url).toBe('https://cnf12345.private.blob.vercel-storage.com/hello.txt');
  });

  it('returns null when SDK raises BlobNotFoundError', async () => {
    mockHead.mockRejectedValue(new BlobNotFoundError());
    const out = await getOp(cfg, 'missing.txt');
    expect(out).toBeNull();
  });

  it('throws E_VERCEL_BLOB_PERMISSION on BlobAccessError', async () => {
    mockHead.mockRejectedValue(new BlobAccessError());
    await expect(getOp(cfg, 'k.txt')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_PERMISSION',
      phase: 'read',
    });
  });

  it('throws E_VERCEL_BLOB_NETWORK on network TypeError', async () => {
    mockHead.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getOp(cfg, 'k.txt')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_NETWORK',
      phase: 'read',
    });
  });

  it('rejects empty key with E_VERCEL_BLOB_INVALID_KEY', async () => {
    await expect(getOp(cfg, '')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_INVALID_KEY',
      phase: 'read',
    });
  });
});
