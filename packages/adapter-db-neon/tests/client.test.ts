import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { neonApi } from '../src/client.js';
import { makeMockFetch, baseConfigInput } from './helpers/mock-fetch.js';

describe('neonApi', () => {
  it('GETs with bearer auth and JSON Accept header', async () => {
    const { fetch, calls } = makeMockFetch({ body: { project: { id: 'p-1' } } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await api.request<{ project: { id: string } }>('GET', '/projects/p-1', {
      phase: 'createProject',
    });
    expect(result.project.id).toBe('p-1');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers['authorization']).toBe('Bearer neon_test');
    expect(calls[0]?.headers['accept']).toBe('application/json');
    expect(calls[0]?.url).toBe('https://console.neon.tech/api/v2/projects/p-1');
  });

  it('POSTs with JSON body', async () => {
    const { fetch, calls } = makeMockFetch({ body: { project: { id: 'p-1' } } });
    const api = neonApi({ ...baseConfigInput, fetch });
    await api.request('POST', '/projects', {
      phase: 'createProject',
      json: { project: { name: 'X' } },
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ project: { name: 'X' } });
  });

  it('returns null on 204', async () => {
    const { fetch } = makeMockFetch({ status: 204, body: '', headers: { 'content-type': 'text/plain' } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await api.request<null>('DELETE', '/projects/p-1', { phase: 'destroyProject' });
    expect(result).toBeNull();
  });

  it('maps 401 to E_NEON_AUTH AgentryError', async () => {
    const { fetch } = makeMockFetch({ status: 401, body: { message: 'invalid token' } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await api.request('GET', '/projects', { phase: 'auth' }).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('narrowing');
    expect(err.code).toBe('E_NEON_AUTH');
  });

  it('honors Retry-After on 429 with one retry', async () => {
    const { fetch, calls } = makeMockFetch(
      { status: 429, headers: { 'retry-after': '0' }, body: { message: 'slow down' } },
      { body: { project: { id: 'p-1' } } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await api.request<{ project: { id: string } }>('GET', '/projects/p-1', {
      phase: 'createProject',
    });
    expect(result.project.id).toBe('p-1');
    expect(calls).toHaveLength(2);
  });

  it('surfaces 429 after exhausting retries as E_NEON_RATE_LIMITED', async () => {
    const { fetch } = makeMockFetch(
      { status: 429, headers: { 'retry-after': '0' }, body: { message: 'slow' } },
      { status: 429, headers: { 'retry-after': '0' }, body: { message: 'slow' } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await api
      .request('GET', '/projects/p-1', { phase: 'createProject' })
      .catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('narrowing');
    expect(err.code).toBe('E_NEON_RATE_LIMITED');
  });

  it('wraps fetch throw as E_NEON_NETWORK', async () => {
    const fetch: typeof globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await api.request('GET', '/projects', { phase: 'auth' }).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('narrowing');
    expect(err.code).toBe('E_NEON_NETWORK');
  });

  it('parses non-JSON error bodies safely (text/plain)', async () => {
    const { fetch } = makeMockFetch({
      status: 502,
      body: 'bad gateway',
      headers: { 'content-type': 'text/plain' },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await api.request('GET', '/projects', { phase: 'auth' }).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('narrowing');
    expect(err.code).toBe('E_NEON_HTTP');
  });
});
