import { describe, it, expect } from 'vitest';
import {
  ADAPTER_ID,
  OPENROUTER_ERROR_CODES,
  openrouterError,
  httpToOpenrouterError,
  networkErr,
  type OpenrouterErrorCode,
} from '../src/errors.js';
import { isAgentryError, AgentryError } from '@openagentry/core';

function makeRes(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

describe('errors — code constants', () => {
  it('exposes 6 stable codes prefixed E_OPENROUTER_', () => {
    const values = Object.values(OPENROUTER_ERROR_CODES);
    expect(values).toHaveLength(6);
    for (const v of values) expect(v).toMatch(/^E_OPENROUTER_/);
  });

  it('exports ADAPTER_ID = llm-openrouter', () => {
    expect(ADAPTER_ID).toBe('llm-openrouter');
  });
});

describe('errors — openrouterError factory', () => {
  it('builds an AgentryError with adapter + code + phase', () => {
    const err = openrouterError({
      code: OPENROUTER_ERROR_CODES.AUTH,
      message: 'bad key',
      phase: 'init',
      suggestedFix: 'Set OA_OPENROUTER_API_KEY.',
    });
    expect(isAgentryError(err)).toBe(true);
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_OPENROUTER_AUTH');
    expect(err.adapter).toBe('llm-openrouter');
    expect(err.phase).toBe('init');
  });

  it('includes context when provided', () => {
    const err = openrouterError({
      code: OPENROUTER_ERROR_CODES.RATE_LIMIT,
      message: 'rate-limited',
      phase: 'generate',
      suggestedFix: 'Back off.',
      context: { retryAfter: 30 },
    });
    expect(err.context).toEqual({ retryAfter: 30 });
  });
});

describe('errors — httpToOpenrouterError dispatch', () => {
  const cases: Array<{ status: number; expected: OpenrouterErrorCode }> = [
    { status: 401, expected: OPENROUTER_ERROR_CODES.AUTH },
    { status: 403, expected: OPENROUTER_ERROR_CODES.AUTH },
    { status: 404, expected: OPENROUTER_ERROR_CODES.NOT_FOUND },
    { status: 429, expected: OPENROUTER_ERROR_CODES.RATE_LIMIT },
    { status: 500, expected: OPENROUTER_ERROR_CODES.UPSTREAM },
    { status: 502, expected: OPENROUTER_ERROR_CODES.UPSTREAM },
    { status: 503, expected: OPENROUTER_ERROR_CODES.UPSTREAM },
    { status: 418, expected: OPENROUTER_ERROR_CODES.UPSTREAM }, // catch-all
  ];

  for (const { status, expected } of cases) {
    it(`HTTP ${status} → ${expected}`, async () => {
      const err = await httpToOpenrouterError(makeRes(status, '{}'), 'generate');
      expect(err.code).toBe(expected);
      expect(err.phase).toBe('generate');
    });
  }

  it('400 with body {error:{code:model_not_found}} → NOT_FOUND', async () => {
    const body = JSON.stringify({ error: { code: 'model_not_found', message: 'no such model' } });
    const err = await httpToOpenrouterError(makeRes(400, body), 'generate');
    expect(err.code).toBe('E_OPENROUTER_NOT_FOUND');
  });

  it('400 with other body → UPSTREAM', async () => {
    const body = JSON.stringify({ error: { code: 'bad_request', message: 'malformed' } });
    const err = await httpToOpenrouterError(makeRes(400, body), 'generate');
    expect(err.code).toBe('E_OPENROUTER_UPSTREAM');
  });

  it('400 with unparseable body → UPSTREAM', async () => {
    const err = await httpToOpenrouterError(makeRes(400, 'not-json'), 'generate');
    expect(err.code).toBe('E_OPENROUTER_UPSTREAM');
  });

  it('429 with Retry-After header sets context.retryAfter', async () => {
    const err = await httpToOpenrouterError(
      makeRes(429, '', { 'Retry-After': '30' }),
      'generate',
    );
    expect(err.context).toMatchObject({ retryAfter: 30 });
  });

  it('429 without Retry-After header omits retryAfter', async () => {
    const err = await httpToOpenrouterError(makeRes(429, ''), 'generate');
    expect(err.context).not.toHaveProperty('retryAfter');
  });

  it('truncates response body in context to 500 chars', async () => {
    const longBody = 'x'.repeat(1000);
    const err = await httpToOpenrouterError(makeRes(500, longBody), 'generate');
    const ctx = err.context as { responseBody?: string };
    expect(typeof ctx.responseBody).toBe('string');
    expect((ctx.responseBody ?? '').length).toBeLessThanOrEqual(500);
  });
});

describe('errors — networkErr', () => {
  it('wraps fetch errors into NETWORK code', () => {
    const err = networkErr(new TypeError('fetch failed'), 'generate');
    expect(err.code).toBe('E_OPENROUTER_NETWORK');
    expect(err.message).toContain('fetch failed');
  });

  it('handles non-Error causes', () => {
    const err = networkErr('something', 'generate');
    expect(err.code).toBe('E_OPENROUTER_NETWORK');
  });
});
