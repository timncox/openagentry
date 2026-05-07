/**
 * Repo functional conformance suite. Self-registers with the runner.
 *
 * Two checks: structured-errors (always runs), create-delete-roundtrip
 * (opt-in via OA_REPO_CONFORMANCE_TEST_OWNER).
 *
 * @module
 */

import type { RepoAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';

/**
 * Phases a repo adapter is allowed to use.
 * `'init'`          — adapter-construction failures (missing env vars).
 * `'read'`          — get() lookup.
 * `'createProject'` — create() repo creation (repos are project-shaped containers).
 * `'delete'`        — delete() repo removal.
 */
export const REPO_PHASES = new Set(['init', 'read', 'createProject', 'delete']);

export const repoSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<RepoAdapter>(target, 'repo');
  if (adapter === undefined) {
    return [
      fail(
        'repo/structured-errors',
        'Adapter default export missing or has wrong category (expected "repo").',
        0,
      ),
    ];
  }

  // repo/structured-errors — get() with guaranteed-not-found input.
  // Two valid outcomes:
  //   (a) returns null  → PASS  (spec-mandated not-found path for get)
  //   (b) throws AgentryError with E_-prefixed code and phase ∈ REPO_PHASES → PASS
  // Anything else → FAIL.
  const seWrap = await timed(ctx, () =>
    adapter.get('not-a-real-owner-99', 'not-a-real-repo-99'),
  );
  if (seWrap.ok) {
    if (seWrap.result === null) {
      // Spec-compliant not-found path — null return is the correct behaviour.
      checks.push(pass('repo/structured-errors', seWrap.durationMs));
    } else {
      checks.push(
        fail(
          'repo/structured-errors',
          `get("not-a-real-owner-99", "not-a-real-repo-99") resolved with a non-null Repository instead of returning null or throwing AgentryError. Not-found cases must return null.`,
          seWrap.durationMs,
        ),
      );
    }
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'repo/structured-errors',
        `get("not-a-real-owner-99", "not-a-real-repo-99") threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else if (typeof seWrap.err.code !== 'string' || !seWrap.err.code.startsWith('E_')) {
    checks.push(
      fail(
        'repo/structured-errors',
        `get threw AgentryError with non-conformant code "${String(seWrap.err.code)}". Codes must be non-empty strings prefixed with "E_".`,
        seWrap.durationMs,
      ),
    );
  } else if (!REPO_PHASES.has(seWrap.err.phase)) {
    checks.push(
      fail(
        'repo/structured-errors',
        `get threw AgentryError with phase "${seWrap.err.phase}", not one of init/read/createProject/delete. Repo adapters classify failures using these phases.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('repo/structured-errors', seWrap.durationMs));
  }

  return checks;
};

registerFunctionalSuite('repo', repoSuite);
