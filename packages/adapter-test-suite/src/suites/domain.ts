/**
 * Domain functional conformance suite. Self-registers with the runner.
 *
 * Two checks: structured-errors (always runs), dns-roundtrip (opt-in
 * via OA_DOMAIN_CONFORMANCE_TEST_DOMAIN).
 *
 * @module
 */

import type { DomainAdapter } from '@openagentry/core';
import type { AgentryErrorPhase } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';

/**
 * Phases a domain adapter is allowed to use.
 * `'init'`     — adapter-construction failures (missing env vars).
 * `'read'`     — checkAvailability, listRecords.
 * `'write'`    — purchase, setRecord, deleteRecord.
 * `'transfer'` — initiateTransfer.
 */
export const DOMAIN_PHASES = new Set<AgentryErrorPhase>(['init', 'read', 'write', 'transfer']);

export const domainSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<DomainAdapter>(target, 'domain');
  if (adapter === undefined) {
    return [
      fail(
        'domain/structured-errors',
        'Adapter default export missing or has wrong category (expected "domain").',
        0,
      ),
    ];
  }

  // (checks added by subsequent tasks)

  return checks;
};

registerFunctionalSuite('domain', domainSuite);
