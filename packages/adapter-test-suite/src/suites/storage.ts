/**
 * Storage functional conformance suite. Self-registers with the runner.
 *
 * Three checks: put-get-delete round-trip, list-prefix, structured errors on
 * empty key.
 *
 * @module
 */

import type { StorageAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';

export const storageSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<StorageAdapter>(target, 'storage');
  if (adapter === undefined) {
    return [
      fail(
        'storage/put-get-delete',
        'Adapter default export missing or has wrong category (expected "storage").',
        0,
      ),
    ];
  }

  const probeKey = `conformance/probe-${Date.now()}`;
  const body = 'conformance-payload';

  // storage/put-get-delete
  const rgWrap = await timed(ctx, async () => {
    const put = await adapter.put(probeKey, body);
    const got = await adapter.get(probeKey);
    if (got === null || got.key !== probeKey) {
      throw new Error(`get() did not return the put object (got ${JSON.stringify(got)}).`);
    }
    await adapter.delete(probeKey);
    const after = await adapter.get(probeKey);
    if (after !== null) {
      throw new Error(`get() after delete must return null (got ${JSON.stringify(after)}).`);
    }
    return put;
  });
  if (rgWrap.ok) {
    checks.push(pass('storage/put-get-delete', rgWrap.durationMs));
  } else {
    checks.push(
      fail('storage/put-get-delete', (rgWrap.err as Error)?.message ?? 'unknown', rgWrap.durationMs),
    );
  }

  // storage/list-prefix
  const lpWrap = await timed(ctx, async () => {
    const prefix = `conformance/list-${Date.now()}-`;
    const keys = [`${prefix}a`, `${prefix}b`, `${prefix}c`];
    for (const k of keys) await adapter.put(k, 'x');
    const seen: string[] = [];
    for await (const obj of adapter.list(prefix)) seen.push(obj.key);
    for (const k of keys) await adapter.delete(k);
    seen.sort();
    if (JSON.stringify(seen) !== JSON.stringify(keys)) {
      throw new Error(`list("${prefix}") returned ${JSON.stringify(seen)} (expected ${JSON.stringify(keys)}).`);
    }
  });
  if (lpWrap.ok) {
    checks.push(pass('storage/list-prefix', lpWrap.durationMs));
  } else {
    checks.push(
      fail('storage/list-prefix', (lpWrap.err as Error)?.message ?? 'unknown', lpWrap.durationMs),
    );
  }

  // storage/structured-errors — empty key must throw AgentryError with E_-prefixed code and a storage-relevant phase.
  const seWrap = await timed(ctx, () => adapter.put('', 'body'));
  const STORAGE_PHASES = new Set(['write', 'read', 'delete', 'list']);
  if (seWrap.ok) {
    checks.push(
      fail(
        'storage/structured-errors',
        'put("", body) must throw AgentryError, but it resolved successfully.',
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'storage/structured-errors',
        `put("", body) threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else if (typeof seWrap.err.code !== 'string' || !seWrap.err.code.startsWith('E_')) {
    checks.push(
      fail(
        'storage/structured-errors',
        `put("", body) threw AgentryError with non-conformant code "${String(seWrap.err.code)}". Codes must be non-empty strings prefixed with "E_".`,
        seWrap.durationMs,
      ),
    );
  } else if (!STORAGE_PHASES.has(seWrap.err.phase)) {
    checks.push(
      fail(
        'storage/structured-errors',
        `put("", body) threw AgentryError with phase "${seWrap.err.phase}", not one of write/read/delete/list. Storage adapters classify failures using these four phases.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('storage/structured-errors', seWrap.durationMs));
  }

  // storage/public-url-roundtrip — opt-in. Verifies put({public:true}) round-trips via get() and the URL is fetchable.
  const supportsPublic =
    (adapter as { getCapabilities?: () => { supportsPublic?: boolean } })
      .getCapabilities?.().supportsPublic === true;
  if (supportsPublic) {
    const pubKey = `conformance/public-${Date.now()}`;
    const pubBody = 'public-conformance-payload';
    const pubWrap = await timed(ctx, async () => {
      const put = await adapter.put(pubKey, pubBody, { public: true });
      try {
        // 1) URL must look like a stable URL (no SigV4 query params).
        if (/[?&]X-Amz-Signature=/.test(put.url)) {
          throw new Error(`put({public:true}) returned a presigned URL (contains X-Amz-Signature). Public uploads must return the publicBaseUrl + key.`);
        }
        // 2) URL must be fetchable.
        const fetched = await fetch(put.url);
        if (!fetched.ok) {
          throw new Error(`fetch(${put.url}) returned ${fetched.status} ${fetched.statusText}. Public URLs must be reachable.`);
        }
        const fetchedBody = await fetched.text();
        if (fetchedBody !== pubBody) {
          throw new Error(`fetched body did not match uploaded body. Got ${JSON.stringify(fetchedBody.slice(0, 64))}.`);
        }
        // 3) get() round-trips the public flag — should also return a stable URL.
        const got = await adapter.get(pubKey);
        if (got === null || /[?&]X-Amz-Signature=/.test(got.url)) {
          throw new Error(`get() did not round-trip the public flag (got ${JSON.stringify(got)}). Expected a stable public URL.`);
        }
        return put;
      } finally {
        // 4) clean up — runs even if assertions above throw.
        await adapter.delete(pubKey);
      }
    });
    if (pubWrap.ok) {
      checks.push(pass('storage/public-url-roundtrip', pubWrap.durationMs));
    } else {
      checks.push(
        fail('storage/public-url-roundtrip', (pubWrap.err as Error)?.message ?? 'unknown', pubWrap.durationMs),
      );
    }
  }

  return checks;
};

registerFunctionalSuite('storage', storageSuite);
