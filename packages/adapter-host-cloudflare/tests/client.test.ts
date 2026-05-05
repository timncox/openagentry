import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { cloudflareApi } from '../src/client.js';
import { makeMockFetch } from './helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 'cf-token',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

describe('cloudflareApi', () => {
  it('attaches Authorization + Content-Type and resolves to the result', async () => {
    const { fetch, calls } = makeMockFetch({ body: { success: true, errors: [], messages: [], result: { hello: 'world' } } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out = await api.request<{ hello: string }>('GET', '/accounts/{account_id}/pages/projects', { phase: 'init' });
    expect(out).toEqual({ hello: 'world' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/pages/projects');
    expect(calls[0]?.headers['authorization']).toBe('Bearer cf-token');
  });

  it('substitutes {account_id} in the path template', async () => {
    const { fetch, calls } = makeMockFetch({ body: { success: true, errors: [], messages: [], result: {} } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    await api.request('DELETE', '/accounts/{account_id}/pages/projects/foo', { phase: 'destroyProject' });
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/pages/projects/foo');
  });

  it('serializes JSON body with content-type', async () => {
    const { fetch, calls } = makeMockFetch({ body: { success: true, errors: [], messages: [], result: {} } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    await api.request('POST', '/accounts/{account_id}/pages/projects', {
      phase: 'createProject',
      json: { name: 'x' },
    });
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toBe('{"name":"x"}');
  });

  it('passes raw body bytes through with provided content-type', async () => {
    const { fetch, calls } = makeMockFetch({ body: { success: true, errors: [], messages: [], result: {} } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    await api.request('PUT', '/accounts/{account_id}/pages/assets/upsert', {
      phase: 'deploy',
      bodyBytes: new TextEncoder().encode('{}'),
      contentType: 'application/octet-stream',
    });
    expect(calls[0]?.headers['content-type']).toBe('application/octet-stream');
    expect(calls[0]?.body).toBe('[bytes]');
  });

  it('maps non-2xx status to AgentryError via cfErrorFromHttp', async () => {
    const { fetch } = makeMockFetch({ body: 'unauthorized', status: 401, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(
      api.request('GET', '/accounts/{account_id}/pages/projects', { phase: 'init' }),
    ).rejects.toMatchObject({ code: 'E_CF_AUTH', phase: 'init' });
  });

  it('maps envelope success:false to AgentryError via cfErrorFromResponse', async () => {
    const { fetch } = makeMockFetch({
      body: { success: false, errors: [{ code: 8000007, message: 'project name already exists' }], messages: [], result: null },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await api.request('POST', '/accounts/{account_id}/pages/projects', {
      phase: 'createProject',
      json: { name: 'dup' },
    }).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('narrowing');
    expect(err.code).toBe('E_CF_PAGES_API');
    expect(err.context?.['cf_code']).toBe(8000007);
  });

  it('retries once on 429 honoring Retry-After', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: 'rate-limited', status: 429, headers: { 'retry-after': '0' } },
      { body: { success: true, errors: [], messages: [], result: { ok: 1 } } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out = await api.request<{ ok: number }>('GET', '/accounts/{account_id}/pages/projects', { phase: 'init' });
    expect(out.ok).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it('gives up after one retry on persistent 429', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: 'rate-limited', status: 429, headers: { 'retry-after': '0' } },
      { body: 'rate-limited', status: 429, headers: { 'retry-after': '0' } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(
      api.request('GET', '/accounts/{account_id}/pages/projects', { phase: 'init' }),
    ).rejects.toMatchObject({ code: 'E_CF_RATE_LIMITED' });
    expect(calls).toHaveLength(2);
  });

  it('returns null for 204 no-content responses', async () => {
    const { fetch } = makeMockFetch({ body: '', status: 204, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out = await api.request('DELETE', '/accounts/{account_id}/pages/projects/foo/domains/x', { phase: 'detachDomain' });
    expect(out).toBeNull();
  });

  it('wraps thrown fetch errors as E_CF_NETWORK', async () => {
    const fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof globalThis.fetch;
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(
      api.request('GET', '/accounts/{account_id}/pages/projects', { phase: 'init' }),
    ).rejects.toMatchObject({ code: 'E_CF_NETWORK', phase: 'init' });
  });
});
