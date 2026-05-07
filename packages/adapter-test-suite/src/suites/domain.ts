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

  // domain/structured-errors — obviously-invalid input must throw AgentryError
  // with an E_-prefixed code and a phase in DOMAIN_PHASES.
  const seWrap = await timed(ctx, () =>
    adapter.checkAvailability('not a domain at all'),
  );
  if (seWrap.ok) {
    checks.push(
      fail(
        'domain/structured-errors',
        'checkAvailability("not a domain at all") must throw AgentryError, but it resolved successfully.',
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'domain/structured-errors',
        `checkAvailability("not a domain at all") threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else if (typeof seWrap.err.code !== 'string' || !seWrap.err.code.startsWith('E_')) {
    checks.push(
      fail(
        'domain/structured-errors',
        `checkAvailability threw AgentryError with non-conformant code "${String(seWrap.err.code)}". Codes must be non-empty strings prefixed with "E_".`,
        seWrap.durationMs,
      ),
    );
  } else if (!DOMAIN_PHASES.has(seWrap.err.phase as AgentryErrorPhase)) {
    checks.push(
      fail(
        'domain/structured-errors',
        `checkAvailability threw AgentryError with phase "${seWrap.err.phase}", not one of init/read/write/transfer. Domain adapters classify failures using these phases.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('domain/structured-errors', seWrap.durationMs));
  }

  return checks;
};

registerFunctionalSuite('domain', domainSuite);
