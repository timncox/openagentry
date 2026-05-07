import { describe, it, expect } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  NAMECHEAP_ERROR_CODES,
  namecheapError,
  httpToNamecheapError,
  networkErr,
  numberToCode,
  apiResponseError,
  type NamecheapErrorCode,
  type ApiResponseEnvelope,
} from '../src/errors.js';

// ---------------------------------------------------------------------------
// ADAPTER_ID
// ---------------------------------------------------------------------------

describe('ADAPTER_ID', () => {
  it('is "domain-namecheap"', () => {
    expect(ADAPTER_ID).toBe('domain-namecheap');
  });
});

// ---------------------------------------------------------------------------
// NAMECHEAP_ERROR_CODES
// ---------------------------------------------------------------------------

describe('NAMECHEAP_ERROR_CODES', () => {
  it('exposes 8 codes (7 runtime + 1 schema)', () => {
    const keys = Object.keys(NAMECHEAP_ERROR_CODES);
    expect(keys).toEqual([
      'AUTH',
      'IP_NOT_WHITELISTED',
      'DOMAIN_NOT_FOUND',
      'INVALID',
      'RATE_LIMIT',
      'NETWORK',
      'UPSTREAM',
      'SCHEMA',
    ]);
  });

  it('all codes start with E_NAMECHEAP_', () => {
    for (const code of Object.values(NAMECHEAP_ERROR_CODES)) {
      expect(code).toMatch(/^E_NAMECHEAP_/);
    }
  });

  it('each code is distinct', () => {
    const values = Object.values(NAMECHEAP_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// namecheapError
// ---------------------------------------------------------------------------

describe('namecheapError', () => {
  it('produces an AgentryError with adapter pre-filled to domain-namecheap', () => {
    const err = namecheapError({
      code: NAMECHEAP_ERROR_CODES.AUTH,
      message: 'bad key',
      phase: 'init',
      suggestedFix: 'check your API key',
      adapter: ADAPTER_ID,
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_NAMECHEAP_AUTH');
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('domain-namecheap');
    expect(err.suggestedFix).toBe('check your API key');
  });

  it('passes through context when provided', () => {
    const err = namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: 'oops',
      phase: 'read',
      suggestedFix: 'retry',
      adapter: ADAPTER_ID,
      context: { httpStatus: 503, responseBody: 'error' },
    });
    expect(err.context).toMatchObject({ httpStatus: 503, responseBody: 'error' });
  });

  it('passes through cause when provided', () => {
    const cause = new Error('inner');
    const err = namecheapError({
      code: NAMECHEAP_ERROR_CODES.NETWORK,
      message: 'net fail',
      phase: 'read',
      suggestedFix: 'check connectivity',
      adapter: ADAPTER_ID,
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it('omits context and cause when not provided', () => {
    const err = namecheapError({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      message: 'm',
      phase: 'write',
      suggestedFix: 'f',
      adapter: ADAPTER_ID,
    });
    expect(err.context).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// httpToNamecheapError
// ---------------------------------------------------------------------------

describe('httpToNamecheapError', () => {
  it('maps 401 to AUTH with phase init', () => {
    const err = httpToNamecheapError(401, '', 'init');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.AUTH);
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('domain-namecheap');
    expect(err.context).toMatchObject({ httpStatus: 401 });
  });

  it('maps 403 to AUTH', () => {
    const err = httpToNamecheapError(403, 'Forbidden', 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.AUTH);
  });

  it('maps 429 to RATE_LIMIT', () => {
    const err = httpToNamecheapError(429, '', 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.RATE_LIMIT);
    expect(err.phase).toBe('read');
  });

  it('maps 500 to UPSTREAM', () => {
    const err = httpToNamecheapError(500, '<html>error</html>', 'write');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.UPSTREAM);
    expect(err.phase).toBe('write');
    expect(err.context).toMatchObject({ httpStatus: 500 });
  });

  it('maps 503 to UPSTREAM', () => {
    const err = httpToNamecheapError(503, '', 'transfer');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.UPSTREAM);
    expect(err.phase).toBe('transfer');
  });

  it('maps an unrecognized 4xx to UPSTREAM', () => {
    const err = httpToNamecheapError(418, '', 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.UPSTREAM);
  });

  it('truncates response body to 500 chars in context', () => {
    const longBody = 'x'.repeat(2000);
    const err = httpToNamecheapError(500, longBody, 'read');
    const ctx = err.context as Record<string, unknown> | undefined;
    expect(typeof ctx?.responseBody).toBe('string');
    expect((ctx?.responseBody as string).length).toBe(500);
  });

  it('preserves short body verbatim', () => {
    const err = httpToNamecheapError(503, 'short body', 'read');
    const ctx = err.context as Record<string, unknown> | undefined;
    expect(ctx?.responseBody).toBe('short body');
  });
});

// ---------------------------------------------------------------------------
// numberToCode
// ---------------------------------------------------------------------------

describe('numberToCode', () => {
  it('maps AUTH numbers correctly', () => {
    expect(numberToCode('1010101')).toBe(NAMECHEAP_ERROR_CODES.AUTH);
    expect(numberToCode('1010102')).toBe(NAMECHEAP_ERROR_CODES.AUTH);
    expect(numberToCode('1017200')).toBe(NAMECHEAP_ERROR_CODES.AUTH);
  });

  it('maps IP_NOT_WHITELISTED numbers correctly', () => {
    expect(numberToCode('1011147')).toBe(NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED);
    expect(numberToCode('1017148')).toBe(NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED);
  });

  it('maps DOMAIN_NOT_FOUND numbers correctly', () => {
    expect(numberToCode('2030280')).toBe(NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND);
    expect(numberToCode('4010331')).toBe(NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND);
    expect(numberToCode('5050900')).toBe(NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND);
  });

  it('maps INVALID numbers correctly', () => {
    expect(numberToCode('2010324')).toBe(NAMECHEAP_ERROR_CODES.INVALID);
    expect(numberToCode('2030288')).toBe(NAMECHEAP_ERROR_CODES.INVALID);
    expect(numberToCode('4011332')).toBe(NAMECHEAP_ERROR_CODES.INVALID);
  });

  it('maps RATE_LIMIT numbers correctly', () => {
    expect(numberToCode('4023273')).toBe(NAMECHEAP_ERROR_CODES.RATE_LIMIT);
    expect(numberToCode('4023274')).toBe(NAMECHEAP_ERROR_CODES.RATE_LIMIT);
  });

  it('returns undefined for unmapped numbers', () => {
    expect(numberToCode('9999999')).toBeUndefined();
    expect(numberToCode('')).toBeUndefined();
    expect(numberToCode('0')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// apiResponseError
// ---------------------------------------------------------------------------

describe('apiResponseError', () => {
  function makeEnvelope(numberStr: string, message: string): ApiResponseEnvelope {
    return {
      ApiResponse: {
        '@_Status': 'ERROR',
        Errors: {
          Error: {
            '@_Number': numberStr,
            '#text': message,
          },
        },
      },
    };
  }

  it('extracts Number + message into context', () => {
    const env = makeEnvelope('1011147', 'IP address is not in whitelist');
    const err = apiResponseError(env, 'init');
    expect(err.context).toMatchObject({
      namecheapNumber: '1011147',
      namecheapMessage: 'IP address is not in whitelist',
    });
  });

  it('maps a known IP_NOT_WHITELISTED number to the correct code', () => {
    const err = apiResponseError(makeEnvelope('1011147', 'IP not whitelisted'), 'init');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED);
    expect(err.phase).toBe('init');
    expect(err.adapter).toBe('domain-namecheap');
  });

  it('maps a known DOMAIN_NOT_FOUND number to the correct code', () => {
    const err = apiResponseError(makeEnvelope('2030280', 'Domain not found'), 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND);
    expect(err.phase).toBe('read');
  });

  it('maps a known INVALID number to the correct code', () => {
    const err = apiResponseError(makeEnvelope('2011280', 'Invalid domain name'), 'write');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.INVALID);
  });

  it('maps an unmapped Number to UPSTREAM', () => {
    const err = apiResponseError(makeEnvelope('9999999', 'Unknown error'), 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.UPSTREAM);
  });

  it('handles an array of errors (uses first)', () => {
    const env: ApiResponseEnvelope = {
      ApiResponse: {
        '@_Status': 'ERROR',
        Errors: {
          Error: [
            { '@_Number': '1010101', '#text': 'First error' },
            { '@_Number': '2030280', '#text': 'Second error' },
          ],
        },
      },
    };
    const err = apiResponseError(env, 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.AUTH);
    expect(err.context).toMatchObject({
      namecheapNumber: '1010101',
      namecheapMessage: 'First error',
    });
  });

  it('handles missing Errors node gracefully', () => {
    const env: ApiResponseEnvelope = {
      ApiResponse: {
        '@_Status': 'ERROR',
      },
    };
    const err = apiResponseError(env, 'write');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.UPSTREAM);
    expect(err.context).toMatchObject({
      namecheapNumber: 'unknown',
      namecheapMessage: 'unknown error',
    });
  });

  it('includes the Number in the error message', () => {
    const err = apiResponseError(makeEnvelope('2030280', 'Domain not found'), 'read');
    expect(err.message).toContain('2030280');
  });
});

// ---------------------------------------------------------------------------
// networkErr
// ---------------------------------------------------------------------------

describe('networkErr', () => {
  it('maps a thrown Error to NETWORK with adapter pre-filled', () => {
    const cause = new Error('ECONNREFUSED 127.0.0.1:443');
    const err = networkErr(cause, 'read');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.NETWORK);
    expect(err.phase).toBe('read');
    expect(err.adapter).toBe('domain-namecheap');
    expect(err.cause).toBe(cause);
  });

  it('handles non-Error thrown values (strings)', () => {
    const err = networkErr('fetch aborted', 'write');
    expect(err.code).toBe(NAMECHEAP_ERROR_CODES.NETWORK);
    expect(err.message).toContain('fetch aborted');
  });

  it('carries the message in context.cause', () => {
    const cause = new Error('timeout');
    const err = networkErr(cause, 'transfer');
    const ctx = err.context as Record<string, unknown> | undefined;
    expect(ctx?.cause).toBe('timeout');
  });

  it('produces phase: transfer when called from transfer op', () => {
    const err = networkErr(new Error('net'), 'transfer');
    expect(err.phase).toBe('transfer');
  });
});

// ---------------------------------------------------------------------------
// NamecheapErrorCode type sanity
// ---------------------------------------------------------------------------

describe('NamecheapErrorCode type', () => {
  it('accepts each code value at runtime', () => {
    const codes: NamecheapErrorCode[] = [
      NAMECHEAP_ERROR_CODES.AUTH,
      NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED,
      NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND,
      NAMECHEAP_ERROR_CODES.INVALID,
      NAMECHEAP_ERROR_CODES.RATE_LIMIT,
      NAMECHEAP_ERROR_CODES.NETWORK,
      NAMECHEAP_ERROR_CODES.UPSTREAM,
      NAMECHEAP_ERROR_CODES.SCHEMA,
    ];
    expect(codes).toHaveLength(8);
  });
});
