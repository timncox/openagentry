import { describe, it, expect } from 'vitest';
import { nextAuthHandler } from '../src/handler.js';
import type { NextAuthOptions } from 'next-auth';

const opts: NextAuthOptions = {
  providers: [{ id: 'credentials', name: 'Credentials', type: 'credentials' } as never],
  session: { strategy: 'jwt' },
  secret: 'sk-handler-test',
};

describe('nextAuthHandler', () => {
  it('returns the result of NextAuth(authOptions)', () => {
    const handler = nextAuthHandler(opts);
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });
});
