import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BlobAccessError,
} from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../../src/config.js';

// Mock the SDK list function before importing our op
vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    list: vi.fn(),
  };
});

const { list: sdkList } = await import('@vercel/blob');
const { listOp } = await import('../../src/ops/list.js');

const cfg: VercelBlobStorageConfig = {
  token: 'vercel_blob_rw_TOKEN',
  defaultAccess: 'private',
  cacheMaxAgePublic: 31_536_000,
  cacheMaxAgePrivate: 3_600,
};

const mockList = vi.mocked(sdkList);

beforeEach(() => {
  mockList.mockReset();
});

function blob(pathname: string, size: number) {
  return {
    url: `https://cnf12345.private.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://cnf12345.private.blob.vercel-storage.com/${pathname}?download=1`,
    pathname,
    size,
    uploadedAt: new Date('2026-05-07T12:00:00.000Z'),
    etag: '"abc"',
  };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('listOp', () => {
  it('yields all blobs from a single page (hasMore: false)', async () => {
    mockList.mockResolvedValue({
      blobs: [blob('a.txt', 1), blob('b.txt', 2), blob('c.txt', 3)],
      hasMore: false,
      cursor: undefined,
    });
    const out = await collect(listOp(cfg));
    expect(out.map((o) => o.key)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(out[0]?.size).toBe(1);
  });

  it('paginates across multiple pages with cursor', async () => {
    mockList
      .mockResolvedValueOnce({
        blobs: [blob('p1.txt', 10)],
        hasMore: true,
        cursor: 'CURSOR_2',
      })
      .mockResolvedValueOnce({
        blobs: [blob('p2.txt', 20)],
        hasMore: false,
        cursor: undefined,
      });
    const out = await collect(listOp(cfg));
    expect(out.map((o) => o.key)).toEqual(['p1.txt', 'p2.txt']);
    expect(mockList).toHaveBeenCalledTimes(2);
    // Second call must include cursor
    expect(mockList.mock.calls[1]![0]).toMatchObject({ cursor: 'CURSOR_2' });
  });

  it('passes prefix to the SDK', async () => {
    mockList.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined });
    await collect(listOp(cfg, 'pictures/'));
    expect(mockList.mock.calls[0]![0]).toMatchObject({ prefix: 'pictures/' });
  });

  it('omits per-blob contentType (Vercel list response shape)', async () => {
    mockList.mockResolvedValue({
      blobs: [blob('one.txt', 1)],
      hasMore: false,
      cursor: undefined,
    });
    const [first] = await collect(listOp(cfg));
    expect(first).toBeDefined();
    expect('contentType' in first!).toBe(false);
  });

  it('maps uploadedAt Date to ISO string', async () => {
    const d = new Date('2026-05-07T12:00:00.000Z');
    mockList.mockResolvedValue({
      blobs: [blob('x.txt', 1)],
      hasMore: false,
      cursor: undefined,
    });
    const [first] = await collect(listOp(cfg));
    expect(first!.uploadedAt).toBe(d.toISOString());
  });

  it('throws E_VERCEL_BLOB_PERMISSION on BlobAccessError', async () => {
    mockList.mockRejectedValue(new BlobAccessError());
    await expect(collect(listOp(cfg))).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_PERMISSION',
      phase: 'list',
    });
  });

  it('throws E_VERCEL_BLOB_NETWORK on network TypeError', async () => {
    mockList.mockRejectedValue(new TypeError('fetch failed'));
    await expect(collect(listOp(cfg))).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_NETWORK',
      phase: 'list',
    });
  });

  it('handles an empty store (zero blobs)', async () => {
    mockList.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined });
    const out = await collect(listOp(cfg));
    expect(out).toEqual([]);
  });
});
