import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { parseVercelBlobStorageConfig, vercelBlobStorageConfigSchema } from '../src/config.js';

describe('vercelBlobStorageConfigSchema', () => {
  it('accepts a minimal config and applies defaults', () => {
    const cfg = parseVercelBlobStorageConfig({ token: 'vercel_blob_rw_TOKEN' });
    expect(cfg).toEqual({
      token: 'vercel_blob_rw_TOKEN',
      defaultAccess: 'private',
      cacheMaxAgePublic: 31_536_000,
      cacheMaxAgePrivate: 3_600,
    });
  });

  it('preserves explicit overrides', () => {
    const cfg = parseVercelBlobStorageConfig({
      token: 'vercel_blob_rw_TOKEN',
      defaultAccess: 'public',
      cacheMaxAgePublic: 600,
      cacheMaxAgePrivate: 60,
    });
    expect(cfg.defaultAccess).toBe('public');
    expect(cfg.cacheMaxAgePublic).toBe(600);
    expect(cfg.cacheMaxAgePrivate).toBe(60);
  });
});

describe('vercelBlobStorageConfigSchema validation failures', () => {
  it('rejects a missing token', () => {
    expect(() => parseVercelBlobStorageConfig({})).toThrow(ZodError);
  });

  it('rejects an empty-after-trim token', () => {
    expect(() => parseVercelBlobStorageConfig({ token: '   ' })).toThrow(ZodError);
  });

  it('trims surrounding whitespace from token', () => {
    const cfg = parseVercelBlobStorageConfig({ token: '  vercel_blob_rw_X  ' });
    expect(cfg.token).toBe('vercel_blob_rw_X');
  });

  it('rejects defaultAccess values other than public/private', () => {
    expect(() => parseVercelBlobStorageConfig({ token: 't', defaultAccess: 'protected' })).toThrow(ZodError);
  });

  it('rejects negative cache max age', () => {
    expect(() => parseVercelBlobStorageConfig({ token: 't', cacheMaxAgePublic: -1 })).toThrow(ZodError);
  });

  it('rejects zero cache max age', () => {
    expect(() => parseVercelBlobStorageConfig({ token: 't', cacheMaxAgePrivate: 0 })).toThrow(ZodError);
  });

  it('rejects non-integer cache max age', () => {
    expect(() => parseVercelBlobStorageConfig({ token: 't', cacheMaxAgePublic: 1.5 })).toThrow(ZodError);
  });

  it('rejects unknown keys (.strict)', () => {
    expect(() => parseVercelBlobStorageConfig({ token: 't', unknownKey: 'x' })).toThrow(ZodError);
  });
});
