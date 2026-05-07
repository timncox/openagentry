import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENV_KEYS = [
  'OA_R2_ACCOUNT_ID',
  'OA_R2_ACCESS_KEY_ID',
  'OA_R2_SECRET_ACCESS_KEY',
  'OA_R2_BUCKET',
  'OA_R2_PUBLIC_BASE_URL',
  'OA_R2_PRESIGN_TTL',
  'OA_R2_ENDPOINT',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

describe('default export (lazy from env)', () => {
  it('does NOT throw at import time when env is missing', async () => {
    const mod = await import('../src/index.js');
    expect(mod.default).toBeDefined();
  });

  it('throws E_R2_CONFIG_INVALID listing missing vars on first method call', async () => {
    const { isAgentryError } = await import('@openagentry/core');
    const mod = await import('../src/index.js');
    try {
      await mod.default.put('k', 'v');
      throw new Error('should have thrown');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_R2_CONFIG_INVALID');
      expect((err as Error).message).toContain('OA_R2_ACCOUNT_ID');
    }
  });

  it('exposes getCapabilities even before config validates', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.default.getCapabilities).toBe('function');
    // Calling it without env still works — returns supportsPublic: false.
    expect(mod.default.getCapabilities().supportsPublic).toBe(false);
  });

  it('works when all env vars set', async () => {
    process.env.OA_R2_ACCOUNT_ID = '0'.repeat(32);
    process.env.OA_R2_ACCESS_KEY_ID = 'AKIA';
    process.env.OA_R2_SECRET_ACCESS_KEY = 'secret';
    process.env.OA_R2_BUCKET = 'b';
    const mod = await import('../src/index.js');
    expect(mod.default.category).toBe('storage');
    expect(mod.default.id).toBe('storage-r2');
  });

  it('exports public surface', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.createR2StorageAdapter).toBe('function');
    expect(typeof mod.parseR2StorageConfig).toBe('function');
    expect(mod.ADAPTER_ID).toBe('storage-r2');
    expect(mod.R2_ERROR_CODES).toBeDefined();
  });
});
