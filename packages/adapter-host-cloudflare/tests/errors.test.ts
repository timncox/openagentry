import { describe, it, expect } from 'vitest';
import { AgentryError, isAgentryError } from '@openagentry/core';
import {
  CF_ERROR_CODES,
  cfErrorFromResponse,
  cfErrorFromHttp,
  cfErrorFromCause,
} from '../src/errors.js';

describe('CF_ERROR_CODES', () => {
  it('exposes the documented stable codes', () => {
    expect(CF_ERROR_CODES.AUTH).toBe('E_CF_AUTH');
    expect(CF_ERROR_CODES.NOT_FOUND).toBe('E_CF_NOT_FOUND');
    expect(CF_ERROR_CODES.RATE_LIMITED).toBe('E_CF_RATE_LIMITED');
    expect(CF_ERROR_CODES.HTTP).toBe('E_CF_HTTP');
    expect(CF_ERROR_CODES.NETWORK).toBe('E_CF_NETWORK');
    expect(CF_ERROR_CODES.SCHEMA).toBe('E_CF_SCHEMA');
    expect(CF_ERROR_CODES.PAGES_API).toBe('E_CF_PAGES_API');
  });
});

describe('cfErrorFromResponse', () => {
  it('maps Cloudflare error envelope to AgentryError with stable code', () => {
    const err = cfErrorFromResponse('createProject', {
      success: false,
      errors: [{ code: 8000007, message: 'project name already exists' }],
      messages: [],
      result: null,
    });
    expect(isAgentryError(err)).toBe(true);
    expect(err.code).toBe('E_CF_PAGES_API');
    expect(err.phase).toBe('createProject');
    expect(err.message).toContain('project name already exists');
    expect(err.context?.['cf_code']).toBe(8000007);
    expect(err.adapter).toBe('host-cloudflare');
  });

  it('reports E_CF_AUTH when Cloudflare returns 10000 (auth) family', () => {
    const err = cfErrorFromResponse('setEnv', {
      success: false,
      errors: [{ code: 10000, message: 'authentication error' }],
      messages: [],
      result: null,
    });
    expect(err.code).toBe('E_CF_AUTH');
    expect(err.suggestedFix).toMatch(/CLOUDFLARE_API_TOKEN/);
  });

  it('falls back to PAGES_API code when no envelope errors', () => {
    const err = cfErrorFromResponse('deploy', { success: false, errors: [], messages: [], result: null });
    expect(err.code).toBe('E_CF_PAGES_API');
    expect(err.message).toMatch(/Cloudflare API call failed/i);
  });

  it('maps codes >= 10100 outside auth family to PAGES_API', () => {
    const err = cfErrorFromResponse('setEnv', {
      success: false,
      errors: [{ code: 10100, message: 'some other error' }],
      messages: [],
      result: null,
    });
    expect(err.code).toBe('E_CF_PAGES_API');
  });
});

describe('cfErrorFromHttp', () => {
  it('maps 401 -> E_CF_AUTH', () => {
    const err = cfErrorFromHttp('getEnv', 401, 'unauthorized');
    expect(err.code).toBe('E_CF_AUTH');
    expect(err.phase).toBe('getEnv');
  });

  it('maps 404 -> E_CF_NOT_FOUND', () => {
    const err = cfErrorFromHttp('rollback', 404, 'not found');
    expect(err.code).toBe('E_CF_NOT_FOUND');
    expect(err.phase).toBe('rollback');
  });

  it('maps 429 -> E_CF_RATE_LIMITED with suggested fix', () => {
    const err = cfErrorFromHttp('deploy', 429, 'too many requests');
    expect(err.code).toBe('E_CF_RATE_LIMITED');
    expect(err.suggestedFix).toMatch(/retry/i);
  });

  it('maps any other status -> E_CF_HTTP with status in context', () => {
    const err = cfErrorFromHttp('deploy', 500, 'internal');
    expect(err.code).toBe('E_CF_HTTP');
    expect(err.context?.['status']).toBe(500);
  });
});

describe('cfErrorFromCause', () => {
  it('wraps a fetch network error', () => {
    const cause = new Error('ECONNREFUSED');
    const err = cfErrorFromCause('logs', cause);
    expect(err.code).toBe('E_CF_NETWORK');
    expect(err.phase).toBe('logs');
    expect((err as Error & { cause?: unknown }).cause).toBe(cause);
  });

  it('passes through AgentryError unchanged', () => {
    const original = new AgentryError({
      code: 'E_CF_NOT_FOUND',
      message: 'x',
      phase: 'rollback',
    });
    const err = cfErrorFromCause('rollback', original);
    expect(err).toBe(original);
  });
});
