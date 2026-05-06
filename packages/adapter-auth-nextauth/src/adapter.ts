/**
 * Assemble the AuthAdapter from the ops modules + parsed config.
 *
 * @module
 */

import type {
  AuthAdapter,
  AuthProvider,
  AuthSession,
} from '@openagentry/core';
import type { NextAuthOptions } from 'next-auth';
import { type NextAuthAdapterConfig, parseNextAuthConfig } from './config.js';
import { listProviders } from './ops/providers.js';
import { verifySession } from './ops/session.js';

export interface NextAuthAuthAdapter extends AuthAdapter {
  readonly category: 'auth';
  readonly id: 'nextauth';
}

export interface CreateNextAuthAuthAdapterInput {
  secret: string;
  authOptions: NextAuthOptions;
}

export function createNextAuthAuthAdapter(
  input: CreateNextAuthAuthAdapterInput,
): NextAuthAuthAdapter {
  const config: NextAuthAdapterConfig = parseNextAuthConfig(input);
  const adapter: NextAuthAuthAdapter = {
    category: 'auth',
    id: 'nextauth',
    listProviders: (): Promise<AuthProvider[]> => listProviders(config.authOptions),
    verifySession: (token: string): Promise<AuthSession | null> =>
      verifySession(config.secret, config.authOptions, token),
  };
  return Object.freeze(adapter);
}
