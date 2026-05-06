/**
 * @openagentry/adapter-auth-nextauth — public entry.
 *
 * Default export: an adapter constructed from process.env.NEXTAUTH_SECRET +
 * a built-in minimal credentials provider. Real users override authOptions
 * by calling `createNextAuthAuthAdapter(input)` directly.
 *
 * @module
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createNextAuthAuthAdapter } from './adapter.js';

export {
  createNextAuthAuthAdapter,
  type NextAuthAuthAdapter,
  type CreateNextAuthAuthAdapterInput,
} from './adapter.js';
export {
  nextAuthConfigSchema,
  parseNextAuthConfig,
  type NextAuthAdapterConfig,
} from './config.js';
export {
  ADAPTER_ID,
  NEXT_AUTH_ERROR_CODES,
  nextAuthError,
  nextAuthErrorFromCause,
  type NextAuthErrorCode,
} from './errors.js';
export { nextAuthHandler } from './handler.js';

const FALLBACK_SECRET =
  'agentry-conformance-test-secret-do-not-use-in-prod';

function resolveDefaultSecret(): string {
  const env = process.env['NEXTAUTH_SECRET'];
  if (env !== undefined && env.length > 0) return env;
  return FALLBACK_SECRET;
}

function buildDefaultAuthOptions(secret: string): NextAuthOptions {
  return {
    secret,
    providers: [
      CredentialsProvider({
        name: 'Conformance',
        credentials: {
          token: { label: 'Token', type: 'text' },
        },
        async authorize() {
          return null;
        },
      }),
    ],
    session: { strategy: 'jwt' },
  };
}

const defaultSecret = resolveDefaultSecret();
const defaultAdapter = createNextAuthAuthAdapter({
  secret: defaultSecret,
  authOptions: buildDefaultAuthOptions(defaultSecret),
});

export default defaultAdapter;
