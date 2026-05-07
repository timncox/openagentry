import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVercelBlobStorageAdapter } from '../src/adapter.js';

vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    put: vi.fn(),
    head: vi.fn(),
    del: vi.fn(),
    list: vi.fn(),
  };
});

const { put: mockPut } = await import('@vercel/blob');

describe('createVercelBlobStorageAdapter', () => {
  beforeEach(() => {
    vi.mocked(mockPut).mockReset();
  });

  it('returns a frozen adapter with category/id', () => {
    const a = createVercelBlobStorageAdapter({ token: 'vercel_blob_rw_T' });
    expect(a.category).toBe('storage');
    expect(a.id).toBe('storage-vercel-blob');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('exposes getCapabilities with defaultAccess from config', () => {
    const priv = createVercelBlobStorageAdapter({ token: 't' }).getCapabilities();
    expect(priv).toEqual({ supportsPublic: true, defaultAccess: 'private' });

    const pub = createVercelBlobStorageAdapter({ token: 't', defaultAccess: 'public' }).getCapabilities();
    expect(pub).toEqual({ supportsPublic: true, defaultAccess: 'public' });
  });

  it('binds put/get/delete/list to the configured token', async () => {
    vi.mocked(mockPut).mockResolvedValue({
      pathname: 'k',
      contentType: 'text/plain',
      contentDisposition: 'inline',
      url: 'https://cnf.private.blob.vercel-storage.com/k',
      downloadUrl: 'https://cnf.private.blob.vercel-storage.com/k?download=1',
      etag: '"e"',
    });
    const a = createVercelBlobStorageAdapter({ token: 't' });
    const out = await a.put('k', 'body');
    expect(out.key).toBe('k');
    // Token was passed through to the SDK
    expect(vi.mocked(mockPut)).toHaveBeenCalledWith('k', expect.anything(), expect.objectContaining({ token: 't' }));
  });

  it('rejects invalid config at construction time', () => {
    expect(() => createVercelBlobStorageAdapter({ token: '' })).toThrow();
  });

  it('all 4 op methods exist', () => {
    const a = createVercelBlobStorageAdapter({ token: 't' });
    expect(typeof a.put).toBe('function');
    expect(typeof a.get).toBe('function');
    expect(typeof a.delete).toBe('function');
    expect(typeof a.list).toBe('function');
    expect(typeof a.getCapabilities).toBe('function');
  });
});
