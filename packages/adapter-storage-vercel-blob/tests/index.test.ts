import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const ENV_KEYS = [
  'OA_VERCEL_BLOB_TOKEN',
  'OA_VERCEL_BLOB_DEFAULT_ACCESS',
  'OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC',
  'OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE',
] as const;

function clearEnv(): void {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

beforeEach(() => {
  clearEnv();
  vi.resetModules();
});

describe('public exports', () => {
  it('exports the named factory + types + codes', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.createVercelBlobStorageAdapter).toBe('function');
    expect(typeof mod.parseVercelBlobStorageConfig).toBe('function');
    expect(mod.ADAPTER_ID).toBe('storage-vercel-blob');
    expect(mod.VERCEL_BLOB_ERROR_CODES).toBeDefined();
  });
});

describe('lazy default export', () => {
  it('does not throw at import time when env is missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    expect(lazy.category).toBe('storage');
    expect(lazy.id).toBe('storage-vercel-blob');
  });

  it('getCapabilities returns a permissive default when env is missing (no throw)', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    expect(lazy.getCapabilities()).toEqual({
      supportsPublic: true,
      defaultAccess: 'private',
    });
  });

  it('throws E_VERCEL_BLOB_CONFIG_INVALID on first put() when token missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.put('k', 'b')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_CONFIG_INVALID',
      phase: 'init',
    });
  });

  it('throws E_VERCEL_BLOB_CONFIG_INVALID on get() when env is invalid', async () => {
    clearEnv();
    process.env.OA_VERCEL_BLOB_TOKEN = 't';
    process.env.OA_VERCEL_BLOB_DEFAULT_ACCESS = 'protected'; // invalid value
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.get('k')).rejects.toMatchObject({
      code: 'E_VERCEL_BLOB_CONFIG_INVALID',
      phase: 'init',
    });
  });
});
