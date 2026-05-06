import { describe, it, expect } from 'vitest';
import { encode } from 'next-auth/jwt';
import { createNextAuthAuthAdapter } from '../src/adapter.js';
import type { NextAuthOptions } from 'next-auth';

const SECRET = 'adapter-test-secret-x';
const validOpts: NextAuthOptions = {
  providers: [{ id: 'credentials', name: 'Credentials', type: 'credentials' } as never],
  session: { strategy: 'jwt' },
};

describe('createNextAuthAuthAdapter', () => {
  it('returns a frozen AuthAdapter with category="auth" and id="nextauth"', () => {
    const a = createNextAuthAuthAdapter({ secret: SECRET, authOptions: validOpts });
    expect(a.category).toBe('auth');
    expect(a.id).toBe('nextauth');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('listProviders delegates correctly', async () => {
    const a = createNextAuthAuthAdapter({ secret: SECRET, authOptions: validOpts });
    const providers = await a.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe('credentials');
  });

  it('verifySession decodes a valid JWT', async () => {
    const a = createNextAuthAuthAdapter({ secret: SECRET, authOptions: validOpts });
    const token = await encode({ token: { sub: 'user-7' }, secret: SECRET, maxAge: 600 });
    const session = await a.verifySession(token);
    expect(session?.userId).toBe('user-7');
  });

  it('verifySession returns null for invalid input', async () => {
    const a = createNextAuthAuthAdapter({ secret: SECRET, authOptions: validOpts });
    expect(await a.verifySession('not-a-jwt')).toBeNull();
  });

  it('throws AgentryError for an unparseable config', () => {
    expect(() =>
      createNextAuthAuthAdapter({ secret: '', authOptions: validOpts } as never),
    ).toThrow();
  });
});
