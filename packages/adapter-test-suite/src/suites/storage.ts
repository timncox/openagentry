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

interface RunWrap<T> {
  ok: boolean;
  result?: T;
  err?: unknown;
  durationMs: number;
}

async function timed<T>(ctx: SuiteCtx, fn: () => Promise<T>): Promise<RunWrap<T>> {
  const start = ctx.now();
  try {
    const result = await fn();
    return { ok: true, result, durationMs: Math.max(0, ctx.now() - start) };
  } catch (err) {
    return { ok: false, err, durationMs: Math.max(0, ctx.now() - start) };
  }
}

function fail(id: string, message: string, durationMs: number): CheckResult {
  return { id, status: 'fail', message, durationMs };
}

function pass(id: string, durationMs: number): CheckResult {
  return { id, status: 'pass', durationMs };
}

function getAdapter(target: LoadedTarget): StorageAdapter | undefined {
  const mod = target.module as { default?: unknown };
  const candidate = mod.default;
  if (candidate === null || typeof candidate !== 'object') return undefined;
  if ((candidate as { category?: string }).category !== 'storage') return undefined;
  return candidate as StorageAdapter;
}

export const storageSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapter(target);
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

  // storage/structured-errors — empty key must throw AgentryError.
  const seWrap = await timed(ctx, () => adapter.put('', 'body'));
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
  } else {
    checks.push(pass('storage/structured-errors', seWrap.durationMs));
  }

  return checks;
};

registerFunctionalSuite('storage', storageSuite);
