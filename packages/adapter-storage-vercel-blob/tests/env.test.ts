import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

describe('readEnvConfig', () => {
  it('returns ok for the minimal env (token only)', () => {
    const r = readEnvConfig({ OA_VERCEL_BLOB_TOKEN: 'vercel_blob_rw_T' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.token).toBe('vercel_blob_rw_T');
      expect(r.config.defaultAccess).toBe('private');
      expect(r.config.cacheMaxAgePublic).toBe(31_536_000);
      expect(r.config.cacheMaxAgePrivate).toBe(3_600);
    }
  });

  it('reports missing token via {kind: missing}', () => {
    const r = readEnvConfig({});
    expect(r).toEqual({ kind: 'missing', missing: ['OA_VERCEL_BLOB_TOKEN'] });
  });

  it('reports an empty-string token as missing', () => {
    const r = readEnvConfig({ OA_VERCEL_BLOB_TOKEN: '' });
    expect(r).toEqual({ kind: 'missing', missing: ['OA_VERCEL_BLOB_TOKEN'] });
  });

  it('honors OA_VERCEL_BLOB_DEFAULT_ACCESS=public', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_DEFAULT_ACCESS: 'public',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.defaultAccess).toBe('public');
    }
  });

  it('returns {kind: invalid} on bad defaultAccess', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_DEFAULT_ACCESS: 'protected',
    });
    expect(r.kind).toBe('invalid');
  });

  it('parses numeric cache max-age env vars', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC: '600',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE: '60',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.cacheMaxAgePublic).toBe(600);
      expect(r.config.cacheMaxAgePrivate).toBe(60);
    }
  });

  it('returns {kind: invalid} on non-numeric cache max-age', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC: 'forever',
    });
    expect(r.kind).toBe('invalid');
  });

  it('returns {kind: invalid} on negative cache max-age', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE: '-1',
    });
    expect(r.kind).toBe('invalid');
  });

  it('treats empty cache max-age strings as unset (uses defaults)', () => {
    const r = readEnvConfig({
      OA_VERCEL_BLOB_TOKEN: 't',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC: '',
      OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE: '',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.cacheMaxAgePublic).toBe(31_536_000);
      expect(r.config.cacheMaxAgePrivate).toBe(3_600);
    }
  });
});
