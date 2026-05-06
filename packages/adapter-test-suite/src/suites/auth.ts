/**
 * Auth functional conformance suite. Self-registers with the runner.
 *
 * Five checks: listProviders, verifySession-roundtrip, verifySession-rejects-invalid,
 * verifySession-rejects-expired, structured-errors.
 *
 * Uses next-auth/jwt's encode() to produce test JWTs with a shared
 * conformance-test secret. Both the suite and the good-auth fixture (and
 * the adapter-auth-nextauth integration test) read the same secret from
 * `process.env.NEXTAUTH_SECRET` (or fall back to `CONFORMANCE_TEST_SECRET`
 * if absent — useful for unit tests that don't want to mutate process.env).
 *
 * @module
 */

import type { AuthAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { fail, getAdapterDefault } from '../internal/suite-helpers.js';

/**
 * Fallback secret used when NEXTAUTH_SECRET is unset. Only valid inside the
 * conformance test suite — never use this in production. Hardcoded so that
 * fixtures and the suite agree without process.env coordination.
 */
export const CONFORMANCE_TEST_SECRET =
  'agentry-conformance-test-secret-do-not-use-in-prod';

export function resolveTestSecret(): string {
  const env = process.env['NEXTAUTH_SECRET'];
  if (env !== undefined && env.length > 0) return env;
  return CONFORMANCE_TEST_SECRET;
}

export const authSuite = async (
  target: LoadedTarget,
  _ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const adapter = getAdapterDefault<AuthAdapter>(target, 'auth');
  if (adapter === undefined) {
    return [
      fail(
        'auth/listProviders',
        'Adapter default export missing or has wrong category (expected "auth").',
        0,
      ),
    ];
  }
  // Functional checks come in Task 2.
  return [];
};

registerFunctionalSuite('auth', authSuite);
