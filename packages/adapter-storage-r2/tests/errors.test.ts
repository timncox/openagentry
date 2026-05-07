import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { ADAPTER_ID, R2_ERROR_CODES, r2Error, httpToR2Error, networkErr } from '../src/errors.js';

describe('errors module', () => {
  it('exports ADAPTER_ID', () => {
    expect(ADAPTER_ID).toBe('storage-r2');
  });

  it('exports the 7 stable error codes', () => {
    expect(R2_ERROR_CODES).toEqual({
      NOT_FOUND: 'E_R2_NOT_FOUND',
      PERMISSION: 'E_R2_PERMISSION',
      INVALID_KEY: 'E_R2_INVALID_KEY',
      NETWORK: 'E_R2_NETWORK',
      PUBLIC_NOT_CONFIGURED: 'E_R2_PUBLIC_NOT_CONFIGURED',
      UPSTREAM: 'E_R2_UPSTREAM',
      CONFIG_INVALID: 'E_R2_CONFIG_INVALID',
    });
  });

  it('r2Error returns AgentryError with adapter id', () => {
    const err = r2Error({
      code: 'E_R2_INVALID_KEY',
      message: 'bad key',
      phase: 'write',
      suggestedFix: 'fix it',
    });
    expect(isAgentryError(err)).toBe(true);
    expect(err.code).toBe('E_R2_INVALID_KEY');
    expect(err.adapter).toBe('storage-r2');
    expect(err.suggestedFix).toBe('fix it');
  });

  it('httpToR2Error maps 401 to E_R2_PERMISSION', async () => {
    const r = new Response('forbidden', { status: 401 });
    const err = await httpToR2Error(r, 'read', 'foo');
    expect(err.code).toBe('E_R2_PERMISSION');
    expect(err.phase).toBe('read');
  });

  it('httpToR2Error maps 403 to E_R2_PERMISSION', async () => {
    const r = new Response('', { status: 403 });
    const err = await httpToR2Error(r, 'write', 'foo');
    expect(err.code).toBe('E_R2_PERMISSION');
  });

  it('httpToR2Error maps 404 to E_R2_NOT_FOUND', async () => {
    const r = new Response('', { status: 404 });
    const err = await httpToR2Error(r, 'read', 'foo');
    expect(err.code).toBe('E_R2_NOT_FOUND');
  });

  it('httpToR2Error maps 500 to E_R2_UPSTREAM', async () => {
    const r = new Response('boom', { status: 500 });
    const err = await httpToR2Error(r, 'list', 'p/');
    expect(err.code).toBe('E_R2_UPSTREAM');
    expect(err.context?.status).toBe(500);
    expect(err.context?.responseBody).toContain('boom');
  });

  it('httpToR2Error maps 418 (unknown 4xx) to E_R2_UPSTREAM', async () => {
    const r = new Response('', { status: 418 });
    const err = await httpToR2Error(r, 'write', 'foo');
    expect(err.code).toBe('E_R2_UPSTREAM');
  });

  it('httpToR2Error truncates large response bodies in details', async () => {
    const big = 'x'.repeat(2000);
    const r = new Response(big, { status: 500 });
    const err = await httpToR2Error(r, 'write', 'foo');
    expect((err.context?.responseBody as string).length).toBeLessThanOrEqual(500);
  });

  it('networkErr wraps thrown errors as E_R2_NETWORK', () => {
    const cause = new TypeError('fetch failed: ECONNREFUSED');
    const err = networkErr(cause, 'read', 'foo');
    expect(err.code).toBe('E_R2_NETWORK');
    expect(err.context?.cause).toContain('ECONNREFUSED');
    expect(err.phase).toBe('read');
  });

  it('all error codes have non-empty suggestedFix', () => {
    const codes = [
      r2Error({ code: 'E_R2_NOT_FOUND', message: 'm', phase: 'read', suggestedFix: 'a' }),
      r2Error({ code: 'E_R2_PERMISSION', message: 'm', phase: 'read', suggestedFix: 'b' }),
      r2Error({ code: 'E_R2_INVALID_KEY', message: 'm', phase: 'write', suggestedFix: 'c' }),
      r2Error({ code: 'E_R2_NETWORK', message: 'm', phase: 'read', suggestedFix: 'd' }),
      r2Error({ code: 'E_R2_PUBLIC_NOT_CONFIGURED', message: 'm', phase: 'write', suggestedFix: 'e' }),
      r2Error({ code: 'E_R2_UPSTREAM', message: 'm', phase: 'list', suggestedFix: 'f' }),
    ];
    for (const e of codes) expect(e.suggestedFix).toBeTruthy();
  });
});
