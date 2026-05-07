import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BlobAccessError,
} from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../../src/config.js';

// Mock the SDK del function before importing our op
vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    del: vi.fn(),
  };
});

const { del: sdkDel } = await import('@vercel/blob');
const { deleteOp } = await import('../../src/ops/delete.js');

const cfg: VercelBlobStorageConfig = {
  token: 'vercel_blob_rw_TOKEN',
  defaultAccess: 'private',
  cacheMaxAgePublic: 31_536_000,
  cacheMaxAgePrivate: 3_600,
};

const mockDel = vi.mocked(sdkDel);

beforeEach(() => {
  mockDel.mockReset();
});

describe('deleteOp', () => {
  it('resolves on successful delete', async () => {
    mockDel.mockResolvedValue(undefined);
    await expect(deleteOp(cfg, 'k.txt')).resolves.toBeUndefined();
  });

  it('passes the key and token to the SDK', async () => {
    mockDel.mockResolvedValue(undefined);
    await deleteOp(cfg, 'k.txt');
    expect(mockDel).toHaveBeenCalledWith('k.txt', { token: cfg.token });
  });

  it('throws E_VERCEL_BLOB_PERMISSION on BlobAccessError', async () => {
    mockDel.mockRejectedValue(new BlobAccessError());
    await expect(deleteOp(cfg, 'k.txt')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_PERMISSION',
      phase: 'delete',
    });
  });

  it('throws E_VERCEL_BLOB_NETWORK on network TypeError', async () => {
    mockDel.mockRejectedValue(new TypeError('fetch failed'));
    await expect(deleteOp(cfg, 'k.txt')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_NETWORK',
      phase: 'delete',
    });
  });

  it('rejects empty key with E_VERCEL_BLOB_INVALID_KEY', async () => {
    await expect(deleteOp(cfg, '')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_INVALID_KEY',
      phase: 'delete',
    });
  });
});
