import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobError,
  BlobFileTooLargeError,
  BlobNotFoundError,
  BlobPathnameMismatchError,
  BlobPreconditionFailedError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
} from '@vercel/blob';
import {
  ADAPTER_ID,
  VERCEL_BLOB_ERROR_CODES,
  sdkErrorToBlobError,
  vercelBlobError,
} from '../src/errors.js';

describe('ADAPTER_ID', () => {
  it('is the expected literal', () => {
    expect(ADAPTER_ID).toBe('storage-vercel-blob');
  });
});

describe('VERCEL_BLOB_ERROR_CODES', () => {
  it('exposes the 6 stable codes', () => {
    expect(VERCEL_BLOB_ERROR_CODES).toEqual({
      NOT_FOUND: 'E_VERCEL_BLOB_NOT_FOUND',
      PERMISSION: 'E_VERCEL_BLOB_PERMISSION',
      INVALID_KEY: 'E_VERCEL_BLOB_INVALID_KEY',
      NETWORK: 'E_VERCEL_BLOB_NETWORK',
      UPSTREAM: 'E_VERCEL_BLOB_UPSTREAM',
      CONFIG_INVALID: 'E_VERCEL_BLOB_CONFIG_INVALID',
    });
  });
});

describe('vercelBlobError', () => {
  it('produces an AgentryError with the expected fields', () => {
    const err = vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.NOT_FOUND,
      message: 'gone',
      phase: 'read',
      suggestedFix: 'list first',
    });
    expect(isAgentryError(err)).toBe(true);
    expect(err.code).toBe('E_VERCEL_BLOB_NOT_FOUND');
    expect(err.adapter).toBe('storage-vercel-blob');
    expect(err.phase).toBe('read');
    expect(err.suggestedFix).toBe('list first');
  });

  it('includes optional context and cause when provided', () => {
    const cause = new Error('original');
    const err = vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: 'upstream',
      phase: 'write',
      suggestedFix: 'retry',
      context: { foo: 1 },
      cause,
    });
    expect(err.context).toEqual({ foo: 1 });
    expect(err.cause).toBe(cause);
  });
});

describe('sdkErrorToBlobError — specific SDK error classes', () => {
  it('BlobNotFoundError → NOT_FOUND', () => {
    const out = sdkErrorToBlobError(new BlobNotFoundError(), 'read', 'a/b.txt');
    expect(out.code).toBe('E_VERCEL_BLOB_NOT_FOUND');
    expect(out.phase).toBe('read');
    expect(out.context).toMatchObject({ key: 'a/b.txt' });
  });

  it('BlobAccessError → PERMISSION', () => {
    const out = sdkErrorToBlobError(new BlobAccessError(), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_PERMISSION');
  });

  it('BlobClientTokenExpiredError → PERMISSION', () => {
    const out = sdkErrorToBlobError(new BlobClientTokenExpiredError(), 'read', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_PERMISSION');
  });

  it('BlobStoreNotFoundError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobStoreNotFoundError(), 'list', undefined);
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobStoreSuspendedError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobStoreSuspendedError(), 'delete', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobServiceNotAvailable → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobServiceNotAvailable(), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobServiceRateLimited → UPSTREAM with retryAfter in context', () => {
    const out = sdkErrorToBlobError(new BlobServiceRateLimited(42), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
    expect(out.context).toMatchObject({ retryAfter: 42 });
  });

  it('BlobUnknownError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobUnknownError(), 'read', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobContentTypeNotAllowedError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobContentTypeNotAllowedError('not allowed'), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobFileTooLargeError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobFileTooLargeError('too big'), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobPathnameMismatchError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobPathnameMismatchError('bad path'), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobPreconditionFailedError → UPSTREAM', () => {
    const out = sdkErrorToBlobError(new BlobPreconditionFailedError(), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('BlobRequestAbortedError → NETWORK', () => {
    const out = sdkErrorToBlobError(new BlobRequestAbortedError(), 'read', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_NETWORK');
  });

  it('generic BlobError → UPSTREAM (catch-all)', () => {
    const out = sdkErrorToBlobError(new BlobError('strange'), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
    expect(out.message).toContain('strange');
  });
});

describe('sdkErrorToBlobError — network heuristics', () => {
  it('TypeError (fetch failed) → NETWORK', () => {
    const out = sdkErrorToBlobError(new TypeError('fetch failed'), 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_NETWORK');
  });

  it('ECONNREFUSED-like errors → NETWORK', () => {
    const out = sdkErrorToBlobError(new Error('connect ECONNREFUSED 127.0.0.1:443'), 'list', undefined);
    expect(out.code).toBe('E_VERCEL_BLOB_NETWORK');
  });

  it('ENOTFOUND errors → NETWORK', () => {
    const out = sdkErrorToBlobError(new Error('getaddrinfo ENOTFOUND blob.vercel-storage.com'), 'read', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_NETWORK');
  });
});

describe('sdkErrorToBlobError — pass-through and fallback', () => {
  it('passes through already-wrapped AgentryError unchanged', () => {
    const wrapped = vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.NOT_FOUND,
      message: 'pre-wrapped',
      phase: 'read',
      suggestedFix: 'fix',
    });
    expect(sdkErrorToBlobError(wrapped, 'write', 'k')).toBe(wrapped);
  });

  it('falls back to UPSTREAM for unknown error types', () => {
    const out = sdkErrorToBlobError({ unknown: true }, 'write', 'k');
    expect(out.code).toBe('E_VERCEL_BLOB_UPSTREAM');
  });

  it('preserves cause through context.cause + Error.cause', () => {
    const original = new Error('original');
    const out = sdkErrorToBlobError(original, 'write', 'k');
    expect(out.context?.cause).toBe('original');
    expect(out.cause).toBe(original);
  });

  it('every code has a non-empty suggestedFix', () => {
    const samples: Array<unknown> = [
      new BlobNotFoundError(),
      new BlobAccessError(),
      new BlobClientTokenExpiredError(),
      new BlobStoreNotFoundError(),
      new BlobError('x'),
      new TypeError('fetch failed'),
      { unknown: true },
    ];
    for (const sample of samples) {
      const out = sdkErrorToBlobError(sample, 'write', 'k');
      expect(typeof out.suggestedFix).toBe('string');
      expect(out.suggestedFix.length).toBeGreaterThan(0);
    }
  });
});
