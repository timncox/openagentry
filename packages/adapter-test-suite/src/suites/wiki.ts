/**
 * Wiki functional conformance suite. Self-registers with the runner.
 *
 * Six checks: list-returns-array, write-then-read, append-extends,
 * search-finds-content, scope-isolation, structured-errors.
 *
 * Verifies a WikiAdapter against a real (or temp-dir-backed) vault.
 *
 * @module
 */

import type { WikiAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { fail, getAdapterDefault, pass, timed } from '../internal/suite-helpers.js';

export const CONFORMANCE_TOKEN = 'agentryconformancetoken';
export const ROUNDTRIP_PATH = 'workspace/conformance-roundtrip.md';
export const APPEND_PATH = 'workspace/conformance-append.md';
export const SEARCH_PATH = 'workspace/conformance-search.md';
export const ISOLATION_PATH = 'workspace/conformance-isolation.md';
export const MISSING_PATH = 'workspace/conformance-does-not-exist.md';

export const wikiSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<WikiAdapter>(target, 'wiki');
  if (adapter === undefined) {
    return [
      fail(
        'wiki/list-returns-array',
        'Adapter default export missing or has wrong category (expected "wiki").',
        0,
      ),
    ];
  }

  // Implementation of 6 checks comes in Task 3.
  return checks;
};

registerFunctionalSuite('wiki', wikiSuite);
