/**
 * listProviders — maps next-auth's authOptions.providers to AuthProvider[].
 *
 * @module
 */

import type { AuthProvider } from '@openagentry/core';
import type { NextAuthOptions } from 'next-auth';
import { NEXT_AUTH_ERROR_CODES, nextAuthError } from '../errors.js';

interface ProviderLike {
  id?: unknown;
  name?: unknown;
}

/**
 * Map each next-auth provider config to an OpenAgentry AuthProvider.
 *
 * Each next-auth provider exposes string `id` and `name`. We map:
 *   id    → AuthProvider.id
 *   name  → AuthProvider.label (falls back to id when name is absent)
 *   true  → AuthProvider.enabled (next-auth has no built-in disabled flag at v0)
 */
export async function listProviders(
  authOptions: NextAuthOptions,
): Promise<AuthProvider[]> {
  const providers = authOptions.providers as ProviderLike[];
  const out: AuthProvider[] = [];
  for (const p of providers) {
    if (typeof p?.id !== 'string' || p.id.length === 0) {
      throw nextAuthError({
        code: NEXT_AUTH_ERROR_CODES.SCHEMA,
        message: `next-auth provider has no string id: ${JSON.stringify(p)}.`,
        phase: 'auth',
        suggestedFix:
          'Each entry in authOptions.providers must be a next-auth provider object with a string `id`.',
      });
    }
    const label =
      typeof p.name === 'string' && p.name.length > 0 ? p.name : p.id;
    out.push({ id: p.id, label, enabled: true });
  }
  return out;
}
