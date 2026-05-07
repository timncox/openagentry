import { describe, it, expect } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  GITHUB_ERROR_CODES,
  githubError,
  httpToGithubError,
  networkErr,
  type GithubErrorCode,
} from '../src/errors.js';

// ---------------------------------------------------------------------------
// ADAPTER_ID
// ---------------------------------------------------------------------------

describe('ADAPTER_ID', () => {
  it('is "repo-github"', () => {
    expect(ADAPTER_ID).toBe('repo-github');
  });
});

// ---------------------------------------------------------------------------
// GITHUB_ERROR_CODES
// ---------------------------------------------------------------------------

describe('GITHUB_ERROR_CODES', () => {
  it('exposes exactly 8 codes (7 runtime + 1 schema)', () => {
    const keys = Object.keys(GITHUB_ERROR_CODES);
    expect(keys).toEqual([
      'AUTH',
      'NOT_FOUND',
      'PERMISSION',
      'INVALID',
      'RATE_LIMIT',
      'NETWORK',
      'UPSTREAM',
      'SCHEMA',
    ]);
  });

  it('all codes start with E_GITHUB_', () => {
    for (const code of Object.values(GITHUB_ERROR_CODES)) {
      expect(code).toMatch(/^E_GITHUB_/);
    }
  });

  it('each code value is distinct', () => {
    const values = Object.values(GITHUB_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// githubError
// ---------------------------------------------------------------------------

describe('githubError', () => {
  it('produces an AgentryError with adapter pre-filled to repo-github', () => {
    const err = githubError({
      code: GITHUB_ERROR_CODES.AUTH,
      message: 'bad token',
      phase: 'init',
      suggestedFix: 'check your token',
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_GITHUB_AUTH');
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('repo-github');
    expect(err.suggestedFix).toBe('check your token');
  });

  it('passes through context when provided', () => {
    const err = githubError({
      code: GITHUB_ERROR_CODES.UPSTREAM,
      message: 'server error',
      phase: 'read',
      suggestedFix: 'retry',
      context: { httpStatus: 503, githubErrorMessage: 'Service Unavailable' },
    });
    expect(err.context).toMatchObject({ httpStatus: 503, githubErrorMessage: 'Service Unavailable' });
  });

  it('passes through cause when provided', () => {
    const cause = new Error('inner');
    const err = githubError({
      code: GITHUB_ERROR_CODES.NETWORK,
      message: 'net fail',
      phase: 'read',
      suggestedFix: 'check connectivity',
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it('passes through retryAfter in context when provided', () => {
    const err = githubError({
      code: GITHUB_ERROR_CODES.RATE_LIMIT,
      message: 'rate limited',
      phase: 'createProject',
      suggestedFix: 'wait',
      context: { retryAfter: 120 },
    });
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(120);
  });

  it('omits context and cause when not provided', () => {
    const err = githubError({
      code: GITHUB_ERROR_CODES.INVALID,
      message: 'bad name',
      phase: 'createProject',
      suggestedFix: 'fix the name',
    });
    expect(err.context).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — 401
// ---------------------------------------------------------------------------

describe('httpToGithubError — 401', () => {
  it('maps 401 to AUTH', () => {
    const err = httpToGithubError(401, null, {}, 'init');
    expect(err.code).toBe(GITHUB_ERROR_CODES.AUTH);
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('repo-github');
    expect(err.context).toMatchObject({ httpStatus: 401 });
  });

  it('includes githubErrorMessage when body has a message', () => {
    const body = { message: 'Bad credentials' };
    const err = httpToGithubError(401, body, {}, 'read');
    expect((err.context as Record<string, unknown>)?.githubErrorMessage).toBe('Bad credentials');
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — 403 (rate limit + permission)
// ---------------------------------------------------------------------------

describe('httpToGithubError — 403 primary rate limit', () => {
  it('maps 403 + X-RateLimit-Remaining: 0 to RATE_LIMIT', () => {
    const headers = { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': null };
    const err = httpToGithubError(403, null, headers, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.RATE_LIMIT);
    expect(err.phase).toBe('createProject');
  });

  it('computes retryAfter from X-RateLimit-Reset epoch', () => {
    const futureEpoch = Math.floor(Date.now() / 1000) + 90;
    const headers = {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(futureEpoch),
    };
    const err = httpToGithubError(403, null, headers, 'createProject');
    const retryAfter = (err.context as Record<string, unknown>)?.retryAfter as number;
    expect(retryAfter).toBeGreaterThanOrEqual(85);
    expect(retryAfter).toBeLessThanOrEqual(95);
  });

  it('defaults retryAfter to 60 when X-RateLimit-Reset is absent', () => {
    const headers = { 'x-ratelimit-remaining': '0' };
    const err = httpToGithubError(403, null, headers, 'read');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(60);
  });
});

describe('httpToGithubError — 403 secondary rate limit', () => {
  it('maps 403 + secondary rate limit message to RATE_LIMIT', () => {
    const body = { message: 'You have exceeded a secondary rate limit and have been temporarily blocked from content creation. Please retry your request again later.' };
    const err = httpToGithubError(403, body, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.RATE_LIMIT);
  });

  it('reads retryAfter from Retry-After header', () => {
    const body = { message: 'You have exceeded a secondary rate limit. Please wait a few minutes.' };
    const headers = { 'retry-after': '45' };
    const err = httpToGithubError(403, body, headers, 'createProject');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(45);
  });

  it('defaults retryAfter to 60 when Retry-After is absent', () => {
    const body = { message: 'You have exceeded a secondary rate limit.' };
    const err = httpToGithubError(403, body, {}, 'createProject');
    expect((err.context as Record<string, unknown>)?.retryAfter).toBe(60);
  });
});

describe('httpToGithubError — 403 permission', () => {
  it('maps plain 403 (no rate-limit signals) to PERMISSION', () => {
    const body = { message: 'Must have admin rights to Repository.' };
    const err = httpToGithubError(403, body, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.PERMISSION);
    expect(err.phase).toBe('createProject');
    expect((err.context as Record<string, unknown>)?.githubErrorMessage).toBe(
      'Must have admin rights to Repository.',
    );
  });

  it('treats 403 with non-zero X-RateLimit-Remaining as PERMISSION', () => {
    const headers = { 'x-ratelimit-remaining': '50' };
    const err = httpToGithubError(403, null, headers, 'delete');
    expect(err.code).toBe(GITHUB_ERROR_CODES.PERMISSION);
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — 404
// ---------------------------------------------------------------------------

describe('httpToGithubError — 404', () => {
  it('maps 404 to NOT_FOUND', () => {
    const body = { message: 'Not Found' };
    const err = httpToGithubError(404, body, {}, 'read');
    expect(err.code).toBe(GITHUB_ERROR_CODES.NOT_FOUND);
    expect(err.phase).toBe('read');
    expect(err.adapter).toBe('repo-github');
  });

  it('works with null body', () => {
    const err = httpToGithubError(404, null, {}, 'delete');
    expect(err.code).toBe(GITHUB_ERROR_CODES.NOT_FOUND);
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — 422
// ---------------------------------------------------------------------------

describe('httpToGithubError — 422', () => {
  it('maps 422 to INVALID with githubErrorMessage in context', () => {
    const body = {
      message: 'Repository creation failed.',
      errors: [{ resource: 'Repository', code: 'custom', field: 'name', message: 'name already exists on this account' }],
    };
    const err = httpToGithubError(422, body, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.INVALID);
    expect(err.phase).toBe('createProject');
    expect((err.context as Record<string, unknown>)?.githubErrorMessage).toBe('Repository creation failed.');
    expect((err.context as Record<string, unknown>)?.githubErrors).toHaveLength(1);
  });

  it('uses fallback message when body.message is absent', () => {
    const err = httpToGithubError(422, null, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.INVALID);
    expect(err.message).toContain('validation failed');
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — 5xx
// ---------------------------------------------------------------------------

describe('httpToGithubError — 5xx', () => {
  it('maps 500 to UPSTREAM', () => {
    const err = httpToGithubError(500, null, {}, 'read');
    expect(err.code).toBe(GITHUB_ERROR_CODES.UPSTREAM);
    expect(err.context).toMatchObject({ httpStatus: 500 });
  });

  it('maps 503 to UPSTREAM', () => {
    const err = httpToGithubError(503, { message: 'Service Unavailable' }, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.UPSTREAM);
    expect(err.phase).toBe('createProject');
  });
});

// ---------------------------------------------------------------------------
// httpToGithubError — other 4xx
// ---------------------------------------------------------------------------

describe('httpToGithubError — other 4xx', () => {
  it('maps an unexpected 4xx (e.g. 418) to UPSTREAM', () => {
    const err = httpToGithubError(418, null, {}, 'read');
    expect(err.code).toBe(GITHUB_ERROR_CODES.UPSTREAM);
  });

  it('maps 409 to UPSTREAM', () => {
    const err = httpToGithubError(409, { message: 'Conflict' }, {}, 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.UPSTREAM);
  });
});

// ---------------------------------------------------------------------------
// networkErr
// ---------------------------------------------------------------------------

describe('networkErr', () => {
  it('maps a thrown Error to NETWORK with adapter pre-filled', () => {
    const cause = new Error('ECONNREFUSED 127.0.0.1:443');
    const err = networkErr(cause, 'read');
    expect(err.code).toBe(GITHUB_ERROR_CODES.NETWORK);
    expect(err.phase).toBe('read');
    expect(err.adapter).toBe('repo-github');
    expect(err.cause).toBe(cause);
  });

  it('handles non-Error thrown values (strings)', () => {
    const err = networkErr('fetch aborted', 'createProject');
    expect(err.code).toBe(GITHUB_ERROR_CODES.NETWORK);
    expect(err.message).toContain('fetch aborted');
  });

  it('carries the message string in context.cause', () => {
    const cause = new Error('timeout after 30s');
    const err = networkErr(cause, 'delete');
    const ctx = err.context as Record<string, unknown> | undefined;
    expect(ctx?.cause).toBe('timeout after 30s');
  });

  it('produces phase: createProject when called from create op', () => {
    const err = networkErr(new Error('net'), 'createProject');
    expect(err.phase).toBe('createProject');
  });

  it('produces phase: delete when called from delete op', () => {
    const err = networkErr(new Error('net'), 'delete');
    expect(err.phase).toBe('delete');
  });

  it('routes through githubError (is an AgentryError, not a plain Error)', () => {
    const err = networkErr(new Error('timeout'), 'read');
    expect(err).toBeInstanceOf(AgentryError);
  });
});

// ---------------------------------------------------------------------------
// GithubErrorCode type sanity (compile-time + runtime)
// ---------------------------------------------------------------------------

describe('GithubErrorCode type', () => {
  it('accepts each code value at runtime', () => {
    const codes: GithubErrorCode[] = [
      GITHUB_ERROR_CODES.AUTH,
      GITHUB_ERROR_CODES.NOT_FOUND,
      GITHUB_ERROR_CODES.PERMISSION,
      GITHUB_ERROR_CODES.INVALID,
      GITHUB_ERROR_CODES.RATE_LIMIT,
      GITHUB_ERROR_CODES.NETWORK,
      GITHUB_ERROR_CODES.UPSTREAM,
      GITHUB_ERROR_CODES.SCHEMA,
    ];
    expect(codes).toHaveLength(8);
  });
});
