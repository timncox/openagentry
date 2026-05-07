import { describe, it, expect } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  VERCEL_ERROR_CODES,
  vercelError,
  httpToVercelError,
  networkErr,
  type VercelErrorCode,
} from '../src/errors.js';

// ---------------------------------------------------------------------------
// ADAPTER_ID
// ---------------------------------------------------------------------------

describe('ADAPTER_ID', () => {
  it('is "host-vercel"', () => {
    expect(ADAPTER_ID).toBe('host-vercel');
  });
});

// ---------------------------------------------------------------------------
// VERCEL_ERROR_CODES
// ---------------------------------------------------------------------------

describe('VERCEL_ERROR_CODES', () => {
  it('exposes exactly 10 codes (9 runtime + 1 schema)', () => {
    const keys = Object.keys(VERCEL_ERROR_CODES);
    expect(keys).toEqual([
      'AUTH',
      'NOT_FOUND',
      'PERMISSION',
      'INVALID',
      'RATE_LIMIT',
      'NETWORK',
      'UPSTREAM',
      'NO_GIT_LINK',
      'BAD_STATE',
      'SCHEMA',
    ]);
  });

  it('all codes start with E_VERCEL_', () => {
    for (const code of Object.values(VERCEL_ERROR_CODES)) {
      expect(code).toMatch(/^E_VERCEL_/);
    }
  });

  it('each code value is distinct', () => {
    const values = Object.values(VERCEL_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// vercelError
// ---------------------------------------------------------------------------

describe('vercelError', () => {
  it('produces an AgentryError with adapter pre-filled to host-vercel', () => {
    const err = vercelError({
      code: VERCEL_ERROR_CODES.AUTH,
      message: 'bad token',
      phase: 'init',
      suggestedFix: 'check your token',
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_VERCEL_AUTH');
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('host-vercel');
    expect(err.suggestedFix).toBe('check your token');
  });

  it('passes through context when provided', () => {
    const err = vercelError({
      code: VERCEL_ERROR_CODES.UPSTREAM,
      message: 'server error',
      phase: 'deploy',
      suggestedFix: 'retry',
      context: { httpStatus: 503, vercelErrorMessage: 'Service Unavailable' },
    });
    expect(err.context).toMatchObject({
      httpStatus: 503,
      vercelErrorMessage: 'Service Unavailable',
    });
  });

  it('passes through cause when provided', () => {
    const cause = new Error('inner');
    const err = vercelError({
      code: VERCEL_ERROR_CODES.NETWORK,
      message: 'net fail',
      phase: 'createProject',
      suggestedFix: 'check connectivity',
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it('passes through retryAfter in context when provided', () => {
    const err = vercelError({
      code: VERCEL_ERROR_CODES.RATE_LIMIT,
      message: 'rate limited',
      phase: 'deploy',
      suggestedFix: 'wait',
      context: { retryAfter: 30 },
    });
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(30);
  });

  it('omits context and cause when not provided', () => {
    const err = vercelError({
      code: VERCEL_ERROR_CODES.INVALID,
      message: 'bad slug',
      phase: 'createProject',
      suggestedFix: 'fix the name',
    });
    expect(err.context).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });

  it('adapter is always host-vercel regardless of what init says', () => {
    const err = vercelError({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      message: 'not found',
      phase: 'destroyProject',
      suggestedFix: 'check id',
      // adapter override is overwritten by the spread
    });
    expect(err.adapter).toBe('host-vercel');
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 401
// ---------------------------------------------------------------------------

describe('httpToVercelError — 401', () => {
  it('maps 401 to AUTH', () => {
    const err = httpToVercelError(401, null, {}, 'init');
    expect(err.code).toBe(VERCEL_ERROR_CODES.AUTH);
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('host-vercel');
    expect(err.context).toMatchObject({ httpStatus: 401 });
  });

  it('includes vercelErrorMessage when body has error.message', () => {
    const body = { error: { code: 'forbidden', message: 'Token is invalid' } };
    const err = httpToVercelError(401, body, {}, 'createProject');
    expect((err.context as Record<string, unknown>)?.vercelErrorMessage).toBe('Token is invalid');
    expect((err.context as Record<string, unknown>)?.vercelErrorCode).toBe('forbidden');
  });

  it('works with null body', () => {
    const err = httpToVercelError(401, null, {}, 'deploy');
    expect(err.code).toBe(VERCEL_ERROR_CODES.AUTH);
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 403
// ---------------------------------------------------------------------------

describe('httpToVercelError — 403', () => {
  it('maps 403 to PERMISSION (not rate limit)', () => {
    const body = { error: { code: 'forbidden', message: 'You do not have access to this resource.' } };
    const err = httpToVercelError(403, body, {}, 'setEnv');
    expect(err.code).toBe(VERCEL_ERROR_CODES.PERMISSION);
    expect(err.phase).toBe('setEnv');
    expect(err.adapter).toBe('host-vercel');
  });

  it('maps 403 with null body to PERMISSION', () => {
    const err = httpToVercelError(403, null, {}, 'attachDomain');
    expect(err.code).toBe(VERCEL_ERROR_CODES.PERMISSION);
  });

  it('does NOT map 403 to RATE_LIMIT (Vercel uses 429 for rate limits)', () => {
    const err = httpToVercelError(403, null, {}, 'createProject');
    expect(err.code).not.toBe(VERCEL_ERROR_CODES.RATE_LIMIT);
    expect(err.code).toBe(VERCEL_ERROR_CODES.PERMISSION);
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 429
// ---------------------------------------------------------------------------

describe('httpToVercelError — 429', () => {
  it('maps 429 to RATE_LIMIT', () => {
    const err = httpToVercelError(429, null, {}, 'deploy');
    expect(err.code).toBe(VERCEL_ERROR_CODES.RATE_LIMIT);
    expect(err.phase).toBe('deploy');
    expect(err.adapter).toBe('host-vercel');
  });

  it('reads retryAfter from Retry-After header', () => {
    const headers = { 'retry-after': '45' };
    const err = httpToVercelError(429, null, headers, 'deploy');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(45);
  });

  it('defaults retryAfter to 60 when Retry-After is absent', () => {
    const err = httpToVercelError(429, null, {}, 'createProject');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(60);
  });

  it('defaults retryAfter to 60 when Retry-After is null', () => {
    const headers: Record<string, string | null> = { 'retry-after': null };
    const err = httpToVercelError(429, null, headers, 'createProject');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(60);
  });

  it('defaults retryAfter to 60 when Retry-After is non-numeric', () => {
    const headers = { 'retry-after': 'soon' };
    const err = httpToVercelError(429, null, headers, 'createProject');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(60);
  });

  it('exposes retryAfter in context', () => {
    const headers = { 'retry-after': '30' };
    const err = httpToVercelError(429, null, headers, 'setEnv');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(30);
  });

  it('includes vercelErrorMessage when present', () => {
    const body = { error: { code: 'rate_limited', message: 'Too many requests' } };
    const headers = { 'retry-after': '10' };
    const err = httpToVercelError(429, body, headers, 'createProject');
    expect((err.context as Record<string, unknown>)?.vercelErrorMessage).toBe('Too many requests');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 404
// ---------------------------------------------------------------------------

describe('httpToVercelError — 404', () => {
  it('maps 404 to NOT_FOUND', () => {
    const body = { error: { code: 'not_found', message: 'The provided project does not exist' } };
    const err = httpToVercelError(404, body, {}, 'getEnv');
    expect(err.code).toBe(VERCEL_ERROR_CODES.NOT_FOUND);
    expect(err.phase).toBe('getEnv');
    expect(err.adapter).toBe('host-vercel');
    expect((err.context as Record<string, unknown>)?.vercelErrorMessage).toBe(
      'The provided project does not exist',
    );
  });

  it('works with null body', () => {
    const err = httpToVercelError(404, null, {}, 'rollback');
    expect(err.code).toBe(VERCEL_ERROR_CODES.NOT_FOUND);
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 400 / 422
// ---------------------------------------------------------------------------

describe('httpToVercelError — 400', () => {
  it('maps 400 to INVALID', () => {
    const body = { error: { code: 'bad_request', message: 'Invalid project name' } };
    const err = httpToVercelError(400, body, {}, 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.INVALID);
    expect(err.phase).toBe('createProject');
    expect((err.context as Record<string, unknown>)?.vercelErrorMessage).toBe('Invalid project name');
  });

  it('uses fallback message when body is null', () => {
    const err = httpToVercelError(400, null, {}, 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.INVALID);
    expect(err.message).toContain('validation failed');
  });
});

describe('httpToVercelError — 422', () => {
  it('maps 422 to INVALID', () => {
    const body = { error: { code: 'invalid_input', message: 'Name already taken' } };
    const err = httpToVercelError(422, body, {}, 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.INVALID);
    expect(err.message).toContain('Name already taken');
  });

  it('uses fallback message when error.message is absent', () => {
    const err = httpToVercelError(422, { error: {} }, {}, 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.INVALID);
    expect(err.message).toContain('validation failed');
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — 5xx
// ---------------------------------------------------------------------------

describe('httpToVercelError — 5xx', () => {
  it('maps 500 to UPSTREAM', () => {
    const err = httpToVercelError(500, null, {}, 'deploy');
    expect(err.code).toBe(VERCEL_ERROR_CODES.UPSTREAM);
    expect(err.context).toMatchObject({ httpStatus: 500 });
  });

  it('maps 502 to UPSTREAM', () => {
    const body = { error: { code: 'bad_gateway', message: 'Bad Gateway' } };
    const err = httpToVercelError(502, body, {}, 'rollback');
    expect(err.code).toBe(VERCEL_ERROR_CODES.UPSTREAM);
    expect(err.phase).toBe('rollback');
  });

  it('maps 503 to UPSTREAM', () => {
    const err = httpToVercelError(503, null, {}, 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.UPSTREAM);
  });
});

// ---------------------------------------------------------------------------
// httpToVercelError — other 4xx
// ---------------------------------------------------------------------------

describe('httpToVercelError — other 4xx', () => {
  it('maps an unexpected 4xx (e.g. 405) to UPSTREAM', () => {
    const err = httpToVercelError(405, null, {}, 'deploy');
    expect(err.code).toBe(VERCEL_ERROR_CODES.UPSTREAM);
  });

  it('maps 409 to UPSTREAM', () => {
    const body = { error: { code: 'conflict', message: 'Conflict' } };
    const err = httpToVercelError(409, body, {}, 'attachDomain');
    expect(err.code).toBe(VERCEL_ERROR_CODES.UPSTREAM);
  });
});

// ---------------------------------------------------------------------------
// networkErr
// ---------------------------------------------------------------------------

describe('networkErr', () => {
  it('maps a thrown Error to NETWORK with adapter pre-filled', () => {
    const cause = new Error('ECONNREFUSED 127.0.0.1:443');
    const err = networkErr(cause, 'deploy');
    expect(err.code).toBe(VERCEL_ERROR_CODES.NETWORK);
    expect(err.phase).toBe('deploy');
    expect(err.adapter).toBe('host-vercel');
    expect(err.cause).toBe(cause);
  });

  it('handles non-Error thrown values (strings)', () => {
    const err = networkErr('fetch aborted', 'createProject');
    expect(err.code).toBe(VERCEL_ERROR_CODES.NETWORK);
    expect(err.message).toContain('fetch aborted');
  });

  it('carries the message string in context.cause', () => {
    const cause = new Error('timeout after 30s');
    const err = networkErr(cause, 'setEnv');
    const ctx = err.context as Record<string, unknown> | undefined;
    expect(ctx?.cause).toBe('timeout after 30s');
  });

  it('produces phase: createProject when called from create op', () => {
    const err = networkErr(new Error('net'), 'createProject');
    expect(err.phase).toBe('createProject');
  });

  it('produces phase: deploy when called from deploy op', () => {
    const err = networkErr(new Error('net'), 'deploy');
    expect(err.phase).toBe('deploy');
  });

  it('routes through vercelError (is an AgentryError, not a plain Error)', () => {
    const err = networkErr(new Error('timeout'), 'getEnv');
    expect(err).toBeInstanceOf(AgentryError);
  });

  it('handles undefined thrown value', () => {
    const err = networkErr(undefined, 'attachDomain');
    expect(err.code).toBe(VERCEL_ERROR_CODES.NETWORK);
    expect(err.message).toContain('undefined');
  });
});

// ---------------------------------------------------------------------------
// VercelErrorCode type sanity (compile-time + runtime)
// ---------------------------------------------------------------------------

describe('VercelErrorCode type', () => {
  it('accepts each code value at runtime', () => {
    const codes: VercelErrorCode[] = [
      VERCEL_ERROR_CODES.AUTH,
      VERCEL_ERROR_CODES.NOT_FOUND,
      VERCEL_ERROR_CODES.PERMISSION,
      VERCEL_ERROR_CODES.INVALID,
      VERCEL_ERROR_CODES.RATE_LIMIT,
      VERCEL_ERROR_CODES.NETWORK,
      VERCEL_ERROR_CODES.UPSTREAM,
      VERCEL_ERROR_CODES.NO_GIT_LINK,
      VERCEL_ERROR_CODES.BAD_STATE,
      VERCEL_ERROR_CODES.SCHEMA,
    ];
    expect(codes).toHaveLength(10);
  });
});
