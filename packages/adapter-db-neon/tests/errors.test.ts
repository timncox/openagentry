import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { NEON_ERROR_CODES, neonErrorFromCause, neonErrorFromResponse } from '../src/errors.js';

describe('neonErrorFromResponse', () => {
  it('maps 401 to E_NEON_AUTH with docs link', () => {
    const err = neonErrorFromResponse('auth', 401, { message: 'bad key', code: 'NOT_AUTHENTICATED' });
    expect(err.code).toBe(NEON_ERROR_CODES.AUTH);
    expect(err.docs).toMatch(/api-keys/);
    expect(err.context).toEqual({ neon_code: 'NOT_AUTHENTICATED' });
  });

  it('maps 403 to E_NEON_AUTH', () => {
    const err = neonErrorFromResponse('auth', 403, { message: 'forbidden' });
    expect(err.code).toBe(NEON_ERROR_CODES.AUTH);
  });

  it('maps 404 to E_NEON_NOT_FOUND', () => {
    const err = neonErrorFromResponse('createProject', 404, { message: 'no such project' });
    expect(err.code).toBe(NEON_ERROR_CODES.NOT_FOUND);
    expect(err.phase).toBe('createProject');
  });

  it('maps 429 to E_NEON_RATE_LIMITED', () => {
    const err = neonErrorFromResponse('createProject', 429, { message: 'slow down' });
    expect(err.code).toBe(NEON_ERROR_CODES.RATE_LIMITED);
  });

  it('maps anything else to E_NEON_HTTP with status in context', () => {
    const err = neonErrorFromResponse('createProject', 500, { message: 'internal' });
    expect(err.code).toBe(NEON_ERROR_CODES.HTTP);
    expect((err.context as { status?: number })?.status).toBe(500);
  });

  it('handles null body without crashing', () => {
    const err = neonErrorFromResponse('createProject', 500, null);
    expect(err.code).toBe(NEON_ERROR_CODES.HTTP);
    expect(err.message).toMatch(/unknown/);
  });
});

describe('neonErrorFromCause', () => {
  it('passes AgentryError through unchanged', () => {
    const original = neonErrorFromResponse('auth', 401, { message: 'x' });
    const wrapped = neonErrorFromCause('auth', original);
    expect(wrapped).toBe(original);
  });

  it('wraps a plain Error as E_NEON_NETWORK', () => {
    const err = neonErrorFromCause('createProject', new Error('ECONNRESET'));
    expect(err.code).toBe(NEON_ERROR_CODES.NETWORK);
    expect(isAgentryError(err)).toBe(true);
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('wraps a non-Error throwable safely', () => {
    const err = neonErrorFromCause('createProject', 'string-throw');
    expect(err.code).toBe(NEON_ERROR_CODES.NETWORK);
  });
});
