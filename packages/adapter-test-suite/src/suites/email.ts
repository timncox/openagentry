/**
 * Email functional conformance suite. Self-registers with the runner.
 *
 * Two checks: structured-errors (always runs), send-returns-id-shape (opt-in
 * via EMAIL_CONFORMANCE_TEST_TO + EMAIL_CONFORMANCE_TEST_FROM).
 *
 * @module
 */

import type { EmailAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';

/**
 * Phases an email adapter is allowed to use. `'send'` for op failures,
 * `'init'` for adapter-construction failures (e.g., missing env var on the
 * default export).
 */
export const EMAIL_PHASES = new Set(['send', 'init']);

export const emailSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<EmailAdapter>(target, 'email');
  if (adapter === undefined) {
    return [
      fail(
        'email/structured-errors',
        'Adapter default export missing or has wrong category (expected "email").',
        0,
      ),
    ];
  }

  // (checks added by subsequent tasks)

  return checks;
};

registerFunctionalSuite('email', emailSuite);
