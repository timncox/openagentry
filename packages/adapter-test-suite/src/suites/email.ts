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

  // email/structured-errors — malformed `from` must throw AgentryError with E_-prefixed code and a send/init phase.
  const seWrap = await timed(ctx, () =>
    adapter.send({
      to: 'recipient@example.com',
      from: 'not-an-email',
      subject: 'oa-conformance structured-errors probe',
      text: 'oa-conformance',
    }),
  );
  if (seWrap.ok) {
    checks.push(
      fail(
        'email/structured-errors',
        'send({from:"not-an-email"}) must throw AgentryError, but it resolved successfully.',
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'email/structured-errors',
        `send({from:"not-an-email"}) threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else if (typeof seWrap.err.code !== 'string' || !seWrap.err.code.startsWith('E_')) {
    checks.push(
      fail(
        'email/structured-errors',
        `send threw AgentryError with non-conformant code "${String(seWrap.err.code)}". Codes must be non-empty strings prefixed with "E_".`,
        seWrap.durationMs,
      ),
    );
  } else if (!EMAIL_PHASES.has(seWrap.err.phase)) {
    checks.push(
      fail(
        'email/structured-errors',
        `send threw AgentryError with phase "${seWrap.err.phase}", not one of send/init. Email adapters classify failures using these phases.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('email/structured-errors', seWrap.durationMs));
  }

  return checks;
};

registerFunctionalSuite('email', emailSuite);
