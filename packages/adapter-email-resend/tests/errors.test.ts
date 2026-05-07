import { describe, it, expect } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  RESEND_ERROR_CODES,
  resendError,
  httpToResendError,
  networkErr,
  type ResendErrorCode,
} from '../src/errors.js';

describe('ADAPTER_ID', () => {
  it('is "email-resend"', () => {
    expect(ADAPTER_ID).toBe('email-resend');
  });
});

describe('RESEND_ERROR_CODES', () => {
  it('exposes 5 stable codes', () => {
    expect(Object.keys(RESEND_ERROR_CODES)).toEqual(['AUTH', 'INVALID', 'RATE_LIMIT', 'NETWORK', 'UPSTREAM']);
  });

  it('all codes start with E_RESEND_', () => {
    for (const code of Object.values(RESEND_ERROR_CODES)) {
      expect(code).toMatch(/^E_RESEND_/);
    }
  });
});

describe('resendError', () => {
  it('produces an AgentryError with adapter pre-filled', () => {
    const err = resendError({
      code: RESEND_ERROR_CODES.AUTH,
      message: 'test',
      phase: 'send',
      suggestedFix: 'fix it',
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_RESEND_AUTH');
    expect(err.phase).toBe('send');
    expect(err.adapter).toBe('email-resend');
    expect(err.suggestedFix).toBe('fix it');
  });

  it('passes through context and cause when provided', () => {
    const cause = new Error('inner');
    const err = resendError({
      code: RESEND_ERROR_CODES.UPSTREAM,
      message: 'm',
      phase: 'send',
      suggestedFix: 'f',
      context: { status: 500 },
      cause,
    });
    expect(err.context).toEqual({ status: 500 });
    expect(err.cause).toBe(cause);
  });

  it('omits context and cause when undefined (exactOptionalPropertyTypes-friendly)', () => {
    const err = resendError({
      code: RESEND_ERROR_CODES.AUTH,
      message: 'm',
      phase: 'init',
      suggestedFix: 'f',
    });
    expect(err.context).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });
});

describe('httpToResendError', () => {
  function makeRes(status: number, body: string, headers: Record<string, string> = {}): Response {
    return new Response(body, { status, headers });
  }

  it('maps 401 to E_RESEND_AUTH/send', async () => {
    const err = await httpToResendError(makeRes(401, '{"name":"missing_api_key"}'), 'send');
    expect(err.code).toBe('E_RESEND_AUTH');
    expect(err.phase).toBe('send');
    expect(err.adapter).toBe('email-resend');
    expect(err.context).toMatchObject({ status: 401 });
  });

  it('maps 403 to E_RESEND_AUTH/send', async () => {
    const err = await httpToResendError(makeRes(403, ''), 'send');
    expect(err.code).toBe('E_RESEND_AUTH');
  });

  it('maps 422 to E_RESEND_INVALID/send', async () => {
    const err = await httpToResendError(makeRes(422, '{"name":"invalid_parameter"}'), 'send');
    expect(err.code).toBe('E_RESEND_INVALID');
    expect(err.phase).toBe('send');
  });

  it('maps 429 to E_RESEND_RATE_LIMIT/send and extracts Retry-After', async () => {
    const err = await httpToResendError(makeRes(429, '', { 'Retry-After': '7' }), 'send');
    expect(err.code).toBe('E_RESEND_RATE_LIMIT');
    expect(err.context).toMatchObject({ retryAfter: 7 });
  });

  it('omits retryAfter when Retry-After is missing or non-numeric', async () => {
    const err = await httpToResendError(makeRes(429, ''), 'send');
    expect(err.code).toBe('E_RESEND_RATE_LIMIT');
    expect((err.context as Record<string, unknown> | undefined)?.retryAfter).toBeUndefined();
  });

  it('maps 500 to E_RESEND_UPSTREAM/send', async () => {
    const err = await httpToResendError(makeRes(500, ''), 'send');
    expect(err.code).toBe('E_RESEND_UPSTREAM');
  });

  it('maps 503 to E_RESEND_UPSTREAM/send', async () => {
    const err = await httpToResendError(makeRes(503, ''), 'send');
    expect(err.code).toBe('E_RESEND_UPSTREAM');
  });

  it('truncates response body to 500 chars in context', async () => {
    const longBody = 'x'.repeat(2000);
    const err = await httpToResendError(makeRes(500, longBody), 'send');
    expect((err.context as Record<string, unknown> | undefined)?.responseBody).toBe('x'.repeat(500));
  });

  it('falls through to UPSTREAM for unrecognized 4xx', async () => {
    const err = await httpToResendError(makeRes(418, ''), 'send');
    expect(err.code).toBe('E_RESEND_UPSTREAM');
  });
});

describe('networkErr', () => {
  it('maps a thrown Error to E_RESEND_NETWORK with adapter pre-filled', () => {
    const cause = new Error('ECONNREFUSED');
    const err = networkErr(cause, 'send');
    expect(err.code).toBe('E_RESEND_NETWORK');
    expect(err.phase).toBe('send');
    expect(err.adapter).toBe('email-resend');
    expect(err.cause).toBe(cause);
  });

  it('handles non-Error thrown values', () => {
    const err = networkErr('string-thrown', 'send');
    expect(err.code).toBe('E_RESEND_NETWORK');
    expect(err.message).toContain('string-thrown');
  });
});

describe('ResendErrorCode type', () => {
  it('accepts each code value', () => {
    const codes: ResendErrorCode[] = [
      RESEND_ERROR_CODES.AUTH,
      RESEND_ERROR_CODES.INVALID,
      RESEND_ERROR_CODES.RATE_LIMIT,
      RESEND_ERROR_CODES.NETWORK,
      RESEND_ERROR_CODES.UPSTREAM,
    ];
    expect(codes).toHaveLength(5);
  });
});
