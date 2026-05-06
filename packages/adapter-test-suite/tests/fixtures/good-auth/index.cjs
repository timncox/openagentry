'use strict';

const { decode } = require('next-auth/jwt');

const FALLBACK_SECRET =
  'agentry-conformance-test-secret-do-not-use-in-prod';

function resolveSecret() {
  const env = process.env['NEXTAUTH_SECRET'];
  if (typeof env === 'string' && env.length > 0) return env;
  return FALLBACK_SECRET;
}

const adapter = {
  category: 'auth',
  id: 'good-auth',
  async listProviders() {
    return [{ id: 'credentials', label: 'Credentials', enabled: true }];
  },
  async verifySession(token) {
    if (typeof token !== 'string' || token.length === 0) return null;
    try {
      const decoded = await decode({ token, secret: resolveSecret() });
      if (decoded === null) return null;
      const sub = decoded.sub;
      if (typeof sub !== 'string' || sub.length === 0) return null;
      const expSec = decoded.exp;
      const expiresAt =
        typeof expSec === 'number'
          ? new Date(expSec * 1000).toISOString()
          : new Date(Date.now() + 3600_000).toISOString();
      const session = { userId: sub, expiresAt };
      if (typeof decoded.email === 'string') session.email = decoded.email;
      if (typeof decoded.name === 'string') session.name = decoded.name;
      return session;
    } catch {
      return null;
    }
  },
};

module.exports = adapter;
module.exports.default = adapter;
