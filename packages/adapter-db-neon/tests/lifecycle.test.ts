import { describe, it, expect } from 'vitest';
import { neonApi } from '../src/client.js';
import { auth, healthcheck, init, refresh } from '../src/lifecycle.js';
import { makeMockFetch, baseConfigInput } from './helpers/mock-fetch.js';

describe('init / refresh', () => {
  it('init is a no-op', async () => {
    const { fetch } = makeMockFetch();
    const api = neonApi({ ...baseConfigInput, fetch });
    await expect(init(api)).resolves.toBeUndefined();
  });
  it('refresh is a no-op', async () => {
    const { fetch } = makeMockFetch();
    const api = neonApi({ ...baseConfigInput, fetch });
    await expect(refresh(api)).resolves.toBeUndefined();
  });
});

describe('auth', () => {
  it('returns ok when /users/me succeeds', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { id: 'u-1', email: 'tim@example.com' },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await auth(api);
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toContain('/users/me');
  });

  it('returns ok=false on 401', async () => {
    const { fetch } = makeMockFetch({ status: 401, body: { message: 'invalid token' } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await auth(api);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/auth/i);
  });
});

describe('healthcheck', () => {
  it('returns status=healthy when token verifies', async () => {
    const { fetch } = makeMockFetch({ body: { id: 'u-1' } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await healthcheck(api);
    expect(result.status).toBe('healthy');
  });

  it('returns status=unhealthy on failure', async () => {
    const { fetch } = makeMockFetch({ status: 503, body: 'down', headers: { 'content-type': 'text/plain' } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const result = await healthcheck(api);
    expect(result.status).toBe('unhealthy');
  });
});
