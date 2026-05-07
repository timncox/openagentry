import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { parseCacheMaxAge, validateKey } from '../src/pathname.js';

describe('validateKey', () => {
  it('accepts a normal pathname', () => {
    expect(() => validateKey('foo/bar.txt', 'write')).not.toThrow();
  });

  it('accepts subfolder pathnames', () => {
    expect(() => validateKey('a/b/c/d.png', 'read')).not.toThrow();
  });

  it('accepts UTF-8 pathnames', () => {
    expect(() => validateKey('å/中/🚀.txt', 'list')).not.toThrow();
  });

  it('throws on empty pathname', () => {
    let thrown: unknown;
    try {
      validateKey('', 'write');
    } catch (err) {
      thrown = err;
    }
    expect(isAgentryError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe('E_VERCEL_BLOB_INVALID_KEY');
  });

  it('throws on leading-slash pathname', () => {
    let thrown: unknown;
    try {
      validateKey('/foo/bar', 'read');
    } catch (err) {
      thrown = err;
    }
    expect(isAgentryError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe('E_VERCEL_BLOB_INVALID_KEY');
  });

  it('phase argument is reflected in the thrown error', () => {
    let thrown: unknown;
    try {
      validateKey('', 'delete');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as { phase: string }).phase).toBe('delete');
  });
});

describe('parseCacheMaxAge', () => {
  it('returns undefined when input is undefined', () => {
    expect(parseCacheMaxAge(undefined)).toBeUndefined();
  });

  it('parses a bare max-age=N', () => {
    expect(parseCacheMaxAge('max-age=3600')).toBe(3600);
  });

  it('parses max-age inside a multi-directive header', () => {
    expect(parseCacheMaxAge('public, max-age=3600, immutable')).toBe(3600);
  });

  it('is case-insensitive', () => {
    expect(parseCacheMaxAge('Public, Max-Age=120')).toBe(120);
  });

  it('returns undefined for headers without max-age', () => {
    expect(parseCacheMaxAge('no-cache')).toBeUndefined();
    expect(parseCacheMaxAge('private')).toBeUndefined();
  });

  it('returns undefined for malformed max-age', () => {
    expect(parseCacheMaxAge('max-age=')).toBeUndefined();
    expect(parseCacheMaxAge('max-age=abc')).toBeUndefined();
  });

  it('returns 0 for max-age=0 (legitimate value)', () => {
    expect(parseCacheMaxAge('max-age=0')).toBe(0);
  });

  it('does not match s-maxage', () => {
    expect(parseCacheMaxAge('s-maxage=3600')).toBeUndefined();
  });
});
