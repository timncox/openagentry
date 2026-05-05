import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { cloudflareApi } from '../src/client.js';
import { auth, healthcheck, init, refresh } from '../src/lifecycle.js';
import { makeMockFetch } from './helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

describe('init / refresh', () => {
  it('init is a no-op', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(init(api)).resolves.toBeUndefined();
  });
  it('refresh is a no-op', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(refresh(api)).resolves.toBeUndefined();
  });
});

describe('auth', () => {
  it('returns ok when /user/tokens/verify succeeds with status active', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: { id: 'tok-1', status: 'active' } },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await auth(api);
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toContain('/user/tokens/verify');
  });

  it('returns ok=false when token verification fails', async () => {
    const { fetch } = makeMockFetch({ body: 'unauthorized', status: 401, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await auth(api);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/auth/i);
  });
});

describe('healthcheck', () => {
  it('returns status=healthy when token verifies', async () => {
    const { fetch } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: { id: 'tok-1', status: 'active' } },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await healthcheck(api);
    expect(result.status).toBe('healthy');
  });

  it('returns status=unhealthy on failure', async () => {
    const { fetch } = makeMockFetch({ body: 'down', status: 503, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await healthcheck(api);
    expect(result.status).toBe('unhealthy');
  });
});
