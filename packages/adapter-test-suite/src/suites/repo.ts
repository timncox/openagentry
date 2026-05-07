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

  // (checks added by subsequent tasks)

  return checks;
};

registerFunctionalSuite('repo', repoSuite);
