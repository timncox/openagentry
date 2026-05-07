/**
 * Domain functional conformance suite. Self-registers with the runner.
 *
 * Two checks: structured-errors (always runs), dns-roundtrip (opt-in
 * via OA_DOMAIN_CONFORMANCE_TEST_DOMAIN).
 *
 * @module
 */

import type { DomainAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';
import { randomUUID } from 'node:crypto';

/**
 * Phases a domain adapter is allowed to use.
 * `'init'`     — adapter-construction failures (missing env vars).
 * `'read'`     — checkAvailability, listRecords.
 * `'write'`    — purchase, setRecord, deleteRecord.
 * `'transfer'` — initiateTransfer.
 */
export const DOMAIN_PHASES = new Set(['init', 'read', 'write', 'transfer']);

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
  } else if (!DOMAIN_PHASES.has(seWrap.err.phase)) {
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

  // domain/dns-roundtrip — opt-in. Set OA_DOMAIN_CONFORMANCE_TEST_DOMAIN to a
  // domain in your account that you consent to mutate (e.g. "example.com").
  // The check adds a TXT record, verifies it is present, removes it, and
  // verifies it is absent. A try/finally ensures cleanup on assertion failure.
  const testDomain = process.env.OA_DOMAIN_CONFORMANCE_TEST_DOMAIN;
  if (testDomain !== undefined && testDomain !== '') {
    const uniqueValue = `oa-conformance-${randomUUID()}`;
    const recordName = '_oa-conformance';
    const recordType = 'TXT' as const;

    const roundtripWrap = await timed(ctx, async () => {
      // (a) Add the TXT record.
      await adapter.setRecord(testDomain, {
        type: recordType,
        name: recordName,
        value: uniqueValue,
        ttl: 60,
      });

      try {
        // (b) List records and assert the new record is present.
        const afterSet = await adapter.listRecords(testDomain);
        const found = afterSet.find(
          (r) => r.type === recordType && r.name === recordName && r.value === uniqueValue,
        );
        if (found === undefined) {
          throw new Error(
            `setRecord succeeded but listRecords did not return the record (type=${recordType}, name=${recordName}, value=${uniqueValue}).`,
          );
        }

        // (c) Delete the record.
        await adapter.deleteRecord(testDomain, {
          type: recordType,
          name: recordName,
          value: uniqueValue,
        });

        // (d) List records again and assert the record is gone.
        const afterDelete = await adapter.listRecords(testDomain);
        const stillPresent = afterDelete.find(
          (r) => r.type === recordType && r.name === recordName && r.value === uniqueValue,
        );
        if (stillPresent !== undefined) {
          throw new Error(
            `deleteRecord succeeded but listRecords still returned the record (type=${recordType}, name=${recordName}, value=${uniqueValue}).`,
          );
        }
      } finally {
        // Cleanup: best-effort delete in case an assertion threw above.
        // Ignore errors here — the primary assertion error is already propagating.
        await adapter
          .deleteRecord(testDomain, { type: recordType, name: recordName, value: uniqueValue })
          .catch(() => undefined);
      }
    });

    if (roundtripWrap.ok) {
      checks.push(pass('domain/dns-roundtrip', roundtripWrap.durationMs));
    } else {
      checks.push(
        fail(
          'domain/dns-roundtrip',
          (roundtripWrap.err as Error)?.message ?? 'unknown error during DNS roundtrip',
          roundtripWrap.durationMs,
        ),
      );
    }
  }

  return checks;
};

registerFunctionalSuite('domain', domainSuite);
