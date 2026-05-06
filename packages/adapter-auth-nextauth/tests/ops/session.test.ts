import { describe, it, expect } from 'vitest';
import { encode } from 'next-auth/jwt';
import type { NextAuthOptions } from 'next-auth';
import { verifySession } from '../../src/ops/session.js';

const SECRET = 'unit-test-secret-1';
const baseOpts: NextAuthOptions = {
  providers: [{ id: 'credentials', name: 'Credentials', type: 'credentials' } as never],
  session: { strategy: 'jwt' },
};

describe('verifySession (JWT strategy)', () => {
  it('returns AuthSession for a valid JWT', async () => {
    const token = await encode({
      token: { sub: 'user-1', email: 'u@example.com', name: 'Una' },
      secret: SECRET,
      maxAge: 600,
    });
    const session = await verifySession(SECRET, baseOpts, token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-1');
    expect(session?.email).toBe('u@example.com');
    expect(session?.name).toBe('Una');
    expect(session?.expiresAt).toMatch(/^\d{4}-/);
  });

  it('returns null for an invalid token', async () => {
    expect(await verifySession(SECRET, baseOpts, 'not-a-jwt')).toBeNull();
  });

  it('returns null for an expired JWT', async () => {
    const expired = await encode({
      token: { sub: 'user-1' },
      secret: SECRET,
      maxAge: -3600,
    });
    expect(await verifySession(SECRET, baseOpts, expired)).toBeNull();
  });

  it('returns null for the empty string', async () => {
    expect(await verifySession(SECRET, baseOpts, '')).toBeNull();
  });

  it('returns null when JWT has no sub claim', async () => {
    const noSub = await encode({
      token: { email: 'orphan@example.com' },
      secret: SECRET,
      maxAge: 600,
    });
    expect(await verifySession(SECRET, baseOpts, noSub)).toBeNull();
  });

  it('returns null when JWT signature does not match secret', async () => {
    const token = await encode({
      token: { sub: 'user-1' },
      secret: 'a-different-secret',
      maxAge: 600,
    });
    expect(await verifySession(SECRET, baseOpts, token)).toBeNull();
  });
});

describe('verifySession (unknown strategy)', () => {
  it('throws E_NEXTAUTH_SCHEMA for an unrecognized session.strategy', async () => {
    const opts = {
      ...baseOpts,
      session: { strategy: 'magic-cookies' },
    } as unknown as NextAuthOptions;
    await expect(verifySession(SECRET, opts, 'irrelevant')).rejects.toThrow(
      /E_NEXTAUTH_SCHEMA|strategy/,
    );
  });
});

describe('verifySession (default strategy)', () => {
  it('treats undefined session as JWT and decodes a valid token', async () => {
    const opts = { ...baseOpts, session: undefined } as unknown as NextAuthOptions;
    const token = await encode({
      token: { sub: 'user-default' },
      secret: SECRET,
      maxAge: 600,
    });
    const session = await verifySession(SECRET, opts, token);
    expect(session?.userId).toBe('user-default');
  });
});
