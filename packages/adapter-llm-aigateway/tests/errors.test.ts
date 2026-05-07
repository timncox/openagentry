import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  AIGATEWAY_ERROR_CODES,
  aigatewayError,
  httpToAigatewayError,
  networkErr,
  sdkErrorToAigatewayError,
} from '../src/errors.js';

describe('ADAPTER_ID', () => {
  it('is the expected literal', () => {
    expect(ADAPTER_ID).toBe('llm-aigateway');
  });
});

describe('AIGATEWAY_ERROR_CODES', () => {
  it('exposes the 6 stable codes', () => {
    expect(AIGATEWAY_ERROR_CODES).toEqual({
      NOT_FOUND: 'E_AIGATEWAY_NOT_FOUND',
      AUTH: 'E_AIGATEWAY_AUTH',
      RATE_LIMIT: 'E_AIGATEWAY_RATE_LIMIT',
      NETWORK: 'E_AIGATEWAY_NETWORK',
      UPSTREAM: 'E_AIGATEWAY_UPSTREAM',
      CONFIG_INVALID: 'E_AIGATEWAY_CONFIG_INVALID',
    });
  });
});

describe('aigatewayError', () => {
  it('produces an AgentryError with the expected fields', () => {
    const err = aigatewayError({
      code: AIGATEWAY_ERROR_CODES.NOT_FOUND,
      message: 'gone',
      phase: 'generate',
      suggestedFix: 'list first',
    });
    expect(isAgentryError(err)).toBe(true);
    expect(err.code).toBe('E_AIGATEWAY_NOT_FOUND');
    expect(err.adapter).toBe('llm-aigateway');
    expect(err.phase).toBe('generate');
    expect(err.suggestedFix).toBe('list first');
  });

  it('includes optional context and cause when provided', () => {
    const cause = new Error('original');
    const err = aigatewayError({
      code: AIGATEWAY_ERROR_CODES.UPSTREAM,
      message: 'upstream',
      phase: 'listModels',
      suggestedFix: 'retry',
      context: { foo: 1 },
      cause,
    });
    expect(err.context).toEqual({ foo: 1 });
    expect(err.cause).toBe(cause);
  });
});

describe('httpToAigatewayError', () => {
  it('maps 401 → AUTH', async () => {
    const r = new Response('{}', { status: 401 });
    const e = await httpToAigatewayError(r, 'listModels');
    expect(e.code).toBe('E_AIGATEWAY_AUTH');
  });
  it('maps 403 → AUTH', async () => {
    const r = new Response('{}', { status: 403 });
    const e = await httpToAigatewayError(r, 'listModels');
    expect(e.code).toBe('E_AIGATEWAY_AUTH');
  });
  it('maps 404 → NOT_FOUND', async () => {
    const r = new Response('{}', { status: 404 });
    const e = await httpToAigatewayError(r, 'generate');
    expect(e.code).toBe('E_AIGATEWAY_NOT_FOUND');
  });
  it('maps 429 → RATE_LIMIT with retryAfter from header', async () => {
    const r = new Response('{}', { status: 429, headers: { 'Retry-After': '42' } });
    const e = await httpToAigatewayError(r, 'generate');
    expect(e.code).toBe('E_AIGATEWAY_RATE_LIMIT');
    expect(e.context).toMatchObject({ retryAfter: 42 });
  });
  it('maps 500 → UPSTREAM', async () => {
    const r = new Response('boom', { status: 500 });
    const e = await httpToAigatewayError(r, 'listModels');
    expect(e.code).toBe('E_AIGATEWAY_UPSTREAM');
  });
});

describe('networkErr', () => {
  it('wraps a fetch failure into NETWORK with cause preserved', () => {
    const orig = new Error('fetch failed: ECONNREFUSED');
    const e = networkErr(orig, 'listModels');
    expect(e.code).toBe('E_AIGATEWAY_NETWORK');
    expect(e.cause).toBe(orig);
    expect(e.context?.cause).toBe('fetch failed: ECONNREFUSED');
  });
});

describe('sdkErrorToAigatewayError — gateway-specific error classes', () => {
  it('GatewayAuthenticationError → AUTH', () => {
    const sdkErr = Object.assign(new Error('not authed'), { name: 'GatewayAuthenticationError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_AUTH');
  });

  it('LoadAPIKeyError → AUTH', () => {
    const sdkErr = Object.assign(new Error('no key'), { name: 'LoadAPIKeyError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_AUTH');
  });

  it('GatewayRateLimitError → RATE_LIMIT', () => {
    const sdkErr = Object.assign(new Error('throttled'), { name: 'GatewayRateLimitError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_RATE_LIMIT');
  });

  it('GatewayModelNotFoundError → NOT_FOUND', () => {
    const sdkErr = Object.assign(new Error('no such model'), { name: 'GatewayModelNotFoundError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_NOT_FOUND');
  });

  it('GatewayInvalidRequestError → UPSTREAM', () => {
    const sdkErr = Object.assign(new Error('bad req'), { name: 'GatewayInvalidRequestError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });

  it('GatewayInternalServerError → UPSTREAM', () => {
    const sdkErr = Object.assign(new Error('boom'), { name: 'GatewayInternalServerError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });

  it('GatewayResponseError → UPSTREAM', () => {
    const sdkErr = Object.assign(new Error('bad response'), { name: 'GatewayResponseError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });

  it('generic GatewayError → UPSTREAM (catch-all)', () => {
    const sdkErr = Object.assign(new Error('generic'), { name: 'GatewayError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });
});

describe('sdkErrorToAigatewayError — generic APICallError', () => {
  it('APICallError 401 → AUTH', () => {
    const sdkErr = Object.assign(new Error('Unauthorized'), { name: 'APICallError', statusCode: 401 });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_AUTH');
  });

  it('APICallError 403 → AUTH', () => {
    const sdkErr = Object.assign(new Error('Forbidden'), { name: 'APICallError', statusCode: 403 });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_AUTH');
  });

  it('APICallError 404 → NOT_FOUND', () => {
    const sdkErr = Object.assign(new Error('Not found'), { name: 'APICallError', statusCode: 404 });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_NOT_FOUND');
  });

  it('APICallError 429 → RATE_LIMIT', () => {
    const sdkErr = Object.assign(new Error('Too many'), { name: 'APICallError', statusCode: 429 });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_RATE_LIMIT');
  });

  it('APICallError 500 → UPSTREAM', () => {
    const sdkErr = Object.assign(new Error('Internal'), { name: 'APICallError', statusCode: 500 });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });

  it('APICallError no statusCode → UPSTREAM', () => {
    const sdkErr = Object.assign(new Error('shrug'), { name: 'APICallError' });
    const out = sdkErrorToAigatewayError(sdkErr, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });
});

describe('sdkErrorToAigatewayError — network + fallback', () => {
  it('TypeError (fetch failed) → NETWORK', () => {
    const out = sdkErrorToAigatewayError(new TypeError('fetch failed'), 'generate');
    expect(out.code).toBe('E_AIGATEWAY_NETWORK');
  });

  it('ECONNREFUSED-like errors → NETWORK', () => {
    const out = sdkErrorToAigatewayError(new Error('connect ECONNREFUSED 127.0.0.1:443'), 'listModels');
    expect(out.code).toBe('E_AIGATEWAY_NETWORK');
  });

  it('passes through already-wrapped AgentryError unchanged', () => {
    const wrapped = aigatewayError({
      code: AIGATEWAY_ERROR_CODES.NOT_FOUND,
      message: 'pre-wrapped',
      phase: 'generate',
      suggestedFix: 'fix',
    });
    expect(sdkErrorToAigatewayError(wrapped, 'generate')).toBe(wrapped);
  });

  it('falls back to UPSTREAM for unknown error types', () => {
    const out = sdkErrorToAigatewayError({ unknown: true }, 'generate');
    expect(out.code).toBe('E_AIGATEWAY_UPSTREAM');
  });

  it('preserves cause through Error.cause and context.cause', () => {
    const original = new Error('original');
    const out = sdkErrorToAigatewayError(original, 'generate');
    expect(out.cause).toBe(original);
    expect(out.context?.cause).toBe('original');
  });

  it('every code has a non-empty suggestedFix', () => {
    const samples: Array<unknown> = [
      Object.assign(new Error('a'), { name: 'GatewayAuthenticationError' }),
      Object.assign(new Error('b'), { name: 'GatewayRateLimitError' }),
      Object.assign(new Error('c'), { name: 'GatewayModelNotFoundError' }),
      Object.assign(new Error('d'), { name: 'APICallError', statusCode: 500 }),
      new TypeError('fetch failed'),
      { unknown: true },
    ];
    for (const sample of samples) {
      const out = sdkErrorToAigatewayError(sample, 'generate');
      expect(typeof out.suggestedFix).toBe('string');
      expect(out.suggestedFix.length).toBeGreaterThan(0);
    }
  });
});
