import { describe, it, expect } from 'vitest';
import { auth, healthcheck, init, refresh } from '../src/lifecycle.js';
import type { NextAuthOptions } from 'next-auth';

const validOpts: NextAuthOptions = {
  providers: [{ id: 'credentials', name: 'Credentials', type: 'credentials' } as never],
  session: { strategy: 'jwt' },
};

describe('init/refresh', () => {
  it('init resolves without error', async () => {
    await expect(init('sk', validOpts)).resolves.toBeUndefined();
  });
  it('refresh resolves without error', async () => {
    await expect(refresh('sk', validOpts)).resolves.toBeUndefined();
  });
});

describe('auth', () => {
  it('returns ok for a valid secret + providers', async () => {
    const result = await auth('sk-real', validOpts);
    expect(result.ok).toBe(true);
  });
  it('returns ok=false when secret is empty', async () => {
    const result = await auth('', validOpts);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/secret/);
  });
  it('returns ok=false when providers is empty', async () => {
    const empty = { ...validOpts, providers: [] } as NextAuthOptions;
    const result = await auth('sk', empty);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/providers/);
  });
});

describe('healthcheck', () => {
  it('returns healthy when auth is ok', async () => {
    const result = await healthcheck('sk', validOpts);
    expect(result.status).toBe('healthy');
  });
  it('returns unhealthy when auth is not ok', async () => {
    const result = await healthcheck('', validOpts);
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/secret/);
  });
});
