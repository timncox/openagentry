import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BlobAccessError,
  BlobServiceNotAvailable,
} from '@vercel/blob';
import type { VercelBlobStorageConfig } from '../../src/config.js';

// Mock the SDK put function before importing our op
vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    put: vi.fn(),
  };
});

// Import after mock is in place
const { put: sdkPut } = await import('@vercel/blob');
const { putOp } = await import('../../src/ops/put.js');

const cfg: VercelBlobStorageConfig = {
  token: 'vercel_blob_rw_TOKEN',
  defaultAccess: 'private',
  cacheMaxAgePublic: 31_536_000,
  cacheMaxAgePrivate: 3_600,
};

function makePutResult(overrides: Partial<{
  url: string;
  pathname: string;
  contentType: string;
}> = {}) {
  return {
    url: overrides.url ?? 'https://abc.private.blob.vercel-storage.com/hello.txt',
    downloadUrl: 'https://abc.private.blob.vercel-storage.com/hello.txt?download=1',
    pathname: overrides.pathname ?? 'hello.txt',
    contentType: overrides.contentType ?? 'text/plain',
    contentDisposition: 'attachment; filename="hello.txt"',
    etag: '"abc123"',
  };
}

const mockPut = vi.mocked(sdkPut);

beforeEach(() => {
  mockPut.mockReset();
  mockPut.mockResolvedValue(makePutResult());
});

describe('putOp happy paths', () => {
  it('uploads a string body and returns a StorageObject', async () => {
    mockPut.mockResolvedValue(makePutResult({ url: 'https://abc.private.blob.vercel-storage.com/hello.txt', pathname: 'hello.txt' }));
    const out = await putOp(cfg, 'hello.txt', 'world');
    expect(out.key).toBe('hello.txt');
    expect(out.size).toBe(5);
    expect(out.url).toMatch(/blob\.vercel-storage\.com\/hello\.txt$/);
    expect(typeof out.uploadedAt).toBe('string');
  });

  it('uploads an ArrayBuffer body with correct byte size', async () => {
    const buf = new TextEncoder().encode('hello arraybuffer').buffer;
    const out = await putOp(cfg, 'b.bin', buf);
    expect(out.size).toBe(17);
  });

  it('uploads a Uint8Array body with correct byte size', async () => {
    const u8 = new TextEncoder().encode('uint8');
    const out = await putOp(cfg, 'u.bin', u8);
    expect(out.size).toBe(5);
  });
});

describe('putOp access and opts behavior', () => {
  it('opts.public=true calls SDK with access="public"', async () => {
    mockPut.mockResolvedValue(makePutResult({ url: 'https://abc.public.blob.vercel-storage.com/p.txt' }));
    const out = await putOp(cfg, 'p.txt', 'p', { public: true });
    expect(out.url).toContain('.public.blob.vercel-storage.com/');
    const calledWith = mockPut.mock.calls[0]![2];
    expect(calledWith?.access).toBe('public');
  });

  it('opts.public=false calls SDK with access="private" (overrides defaultAccess=public)', async () => {
    const publicCfg: VercelBlobStorageConfig = { ...cfg, defaultAccess: 'public' };
    mockPut.mockResolvedValue(makePutResult({ url: 'https://abc.private.blob.vercel-storage.com/priv.txt' }));
    const out = await putOp(publicCfg, 'priv.txt', 'p', { public: false });
    expect(out.url).toContain('.private.blob.vercel-storage.com/');
    const calledWith = mockPut.mock.calls[0]![2];
    expect(calledWith?.access).toBe('private');
  });

  it('opts.public=undefined uses cfg.defaultAccess', async () => {
    mockPut.mockResolvedValue(makePutResult({ url: 'https://abc.public.blob.vercel-storage.com/d.txt' }));
    const out = await putOp({ ...cfg, defaultAccess: 'public' }, 'd.txt', 'd');
    expect(out.url).toContain('.public.blob.vercel-storage.com/');
    const calledWith = mockPut.mock.calls[0]![2];
    expect(calledWith?.access).toBe('public');
  });

  it('passes contentType through when supplied', async () => {
    mockPut.mockResolvedValue(makePutResult({ contentType: 'application/x-custom' }));
    const out = await putOp(cfg, 'a.bin', 'x', { contentType: 'application/x-custom' });
    expect(out.contentType).toBe('application/x-custom');
    const calledWith = mockPut.mock.calls[0]![2];
    expect(calledWith?.contentType).toBe('application/x-custom');
  });

  it('always sets addRandomSuffix=false and allowOverwrite=true', async () => {
    await putOp(cfg, 'k.txt', 'v');
    const calledWith = mockPut.mock.calls[0]![2];
    expect(calledWith?.addRandomSuffix).toBe(false);
    expect(calledWith?.allowOverwrite).toBe(true);
  });

  it('rejects empty key with E_VERCEL_BLOB_INVALID_KEY', async () => {
    await expect(putOp(cfg, '', 'x')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_INVALID_KEY',
      phase: 'write',
    });
  });

  it('rejects leading-slash key with E_VERCEL_BLOB_INVALID_KEY', async () => {
    await expect(putOp(cfg, '/oops', 'x')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_INVALID_KEY',
    });
  });
});

describe('putOp error mapping', () => {
  it('BlobAccessError → E_VERCEL_BLOB_PERMISSION', async () => {
    mockPut.mockRejectedValue(new BlobAccessError());
    await expect(putOp(cfg, 'p.txt', 'x')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_PERMISSION',
      phase: 'write',
    });
  });

  it('BlobServiceNotAvailable → E_VERCEL_BLOB_UPSTREAM', async () => {
    mockPut.mockRejectedValue(new BlobServiceNotAvailable());
    await expect(putOp(cfg, 'p.txt', 'x')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_UPSTREAM',
      phase: 'write',
    });
  });

  it('network TypeError → E_VERCEL_BLOB_NETWORK', async () => {
    mockPut.mockRejectedValue(new TypeError('fetch failed'));
    await expect(putOp(cfg, 'p.txt', 'x')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_NETWORK',
      phase: 'write',
    });
  });
});
