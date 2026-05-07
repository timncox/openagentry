import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { validateKey } from '../src/validate-key.js';

describe('validateKey', () => {
  it('accepts a normal key', () => {
    expect(() => validateKey('a/b/c.txt', 'write')).not.toThrow();
  });

  it('throws E_R2_INVALID_KEY for empty string', () => {
    try {
      validateKey('', 'write');
      throw new Error('should have thrown');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_R2_INVALID_KEY');
    }
  });

  it('throws for leading slash', () => {
    expect(() => validateKey('/foo', 'write')).toThrow();
  });

  it('throws for double slashes', () => {
    expect(() => validateKey('a//b', 'write')).toThrow();
  });

  it('throws for control characters', () => {
    expect(() => validateKey('a\x00b', 'write')).toThrow();
    expect(() => validateKey('a\x1fb', 'write')).toThrow();
  });

  it('throws for keys longer than 1024 chars', () => {
    expect(() => validateKey('x'.repeat(1025), 'write')).toThrow();
  });

  it('accepts keys exactly 1024 chars', () => {
    expect(() => validateKey('x'.repeat(1024), 'write')).not.toThrow();
  });
});
