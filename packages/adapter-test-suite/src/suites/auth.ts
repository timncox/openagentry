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
import { isAgentryError } from '../internal/is-agentry-error.js';
import { fail, getAdapterDefault, pass, timed } from '../internal/suite-helpers.js';
import { encode } from 'next-auth/jwt';

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
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
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

  const secret = resolveTestSecret();
  const TEST_USER_ID = 'conformance-user-1';

  // auth/listProviders — non-empty array, each entry shaped { id, label, enabled }.
  const lpWrap = await timed(ctx, () => adapter.listProviders());
  if (!lpWrap.ok || lpWrap.result === undefined) {
    checks.push(
      fail(
        'auth/listProviders',
        `listProviders threw: ${(lpWrap.err as Error)?.message ?? 'unknown'}`,
        lpWrap.durationMs,
      ),
    );
  } else if (!Array.isArray(lpWrap.result) || lpWrap.result.length === 0) {
    checks.push(
      fail(
        'auth/listProviders',
        'listProviders must return a non-empty AuthProvider[].',
        lpWrap.durationMs,
      ),
    );
  } else {
    const bad = lpWrap.result.find(
      (p) =>
        typeof p?.id !== 'string' ||
        typeof p?.label !== 'string' ||
        typeof p?.enabled !== 'boolean',
    );
    if (bad !== undefined) {
      checks.push(
        fail(
          'auth/listProviders',
          `listProviders returned a provider with bad shape: ${JSON.stringify(bad)}.`,
          lpWrap.durationMs,
        ),
      );
    } else {
      checks.push(
        pass('auth/listProviders', lpWrap.durationMs, {
          providerCount: lpWrap.result.length,
        }),
      );
    }
  }

  // auth/verifySession-roundtrip — encode a valid JWT, verifySession should return AuthSession with matching userId.
  const validToken = await encode({
    token: { sub: TEST_USER_ID, email: 'probe@conformance.test' },
    secret,
    maxAge: 600,
  });
  const vrWrap = await timed(ctx, () => adapter.verifySession(validToken));
  if (!vrWrap.ok) {
    checks.push(
      fail(
        'auth/verifySession-roundtrip',
        `verifySession threw on valid token: ${(vrWrap.err as Error)?.message ?? 'unknown'}`,
        vrWrap.durationMs,
      ),
    );
  } else if (vrWrap.result === null || vrWrap.result === undefined) {
    checks.push(
      fail(
        'auth/verifySession-roundtrip',
        'verifySession returned null for a valid JWT signed with the configured secret.',
        vrWrap.durationMs,
      ),
    );
  } else if (vrWrap.result.userId !== TEST_USER_ID) {
    checks.push(
      fail(
        'auth/verifySession-roundtrip',
        `verifySession returned userId="${vrWrap.result.userId}" (expected "${TEST_USER_ID}").`,
        vrWrap.durationMs,
      ),
    );
  } else {
    checks.push(
      pass('auth/verifySession-roundtrip', vrWrap.durationMs, {
        userId: vrWrap.result.userId,
      }),
    );
  }

  // auth/verifySession-rejects-invalid — bogus string must return null (NOT throw).
  const invWrap = await timed(ctx, () =>
    adapter.verifySession('not-a-real-token'),
  );
  if (!invWrap.ok) {
    checks.push(
      fail(
        'auth/verifySession-rejects-invalid',
        `verifySession threw on invalid token (must return null instead): ${(invWrap.err as Error)?.message ?? 'unknown'}`,
        invWrap.durationMs,
      ),
    );
  } else if (invWrap.result !== null) {
    checks.push(
      fail(
        'auth/verifySession-rejects-invalid',
        `verifySession returned ${JSON.stringify(invWrap.result)} for an obviously invalid token (must be null).`,
        invWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('auth/verifySession-rejects-invalid', invWrap.durationMs));
  }

  // auth/verifySession-rejects-expired — encode an already-expired JWT; verifySession must return null.
  const expiredToken = await encode({
    token: { sub: TEST_USER_ID },
    secret,
    maxAge: -3600,
  });
  const exWrap = await timed(ctx, () => adapter.verifySession(expiredToken));
  if (!exWrap.ok) {
    checks.push(
      fail(
        'auth/verifySession-rejects-expired',
        `verifySession threw on expired token (must return null instead): ${(exWrap.err as Error)?.message ?? 'unknown'}`,
        exWrap.durationMs,
      ),
    );
  } else if (exWrap.result !== null) {
    checks.push(
      fail(
        'auth/verifySession-rejects-expired',
        `verifySession returned ${JSON.stringify(exWrap.result)} for an expired JWT (must be null).`,
        exWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('auth/verifySession-rejects-expired', exWrap.durationMs));
  }

  // auth/structured-errors — verifySession with empty-string token must return null
  // (NOT throw). Adapters that throw a plain Error here violate the contract;
  // adapters that throw AgentryError still violate the "return null" rule but are
  // less broken. We only fail if the call throws AND the thrown thing isn't an
  // AgentryError-shaped object — which would mean a totally unstructured failure.
  const seWrap = await timed(ctx, () => adapter.verifySession(''));
  if (!seWrap.ok) {
    if (!isAgentryError(seWrap.err)) {
      checks.push(
        fail(
          'auth/structured-errors',
          `verifySession('') threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter-side failures must be AgentryError.`,
          seWrap.durationMs,
        ),
      );
    } else {
      checks.push(
        pass('auth/structured-errors', seWrap.durationMs, {
          code: seWrap.err.code,
          note: 'threw AgentryError instead of returning null — acceptable but borderline',
        }),
      );
    }
  } else if (seWrap.result !== null) {
    checks.push(
      fail(
        'auth/structured-errors',
        `verifySession('') returned a session object instead of null — empty input must never authenticate.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('auth/structured-errors', seWrap.durationMs));
  }

  return checks;
};

registerFunctionalSuite('auth', authSuite);
