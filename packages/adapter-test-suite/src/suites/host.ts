/**
 * Host functional conformance suite. Self-registers with the runner.
 *
 * Five checks: createProject, setEnv (idempotent), getEnv (round-trip),
 * exportState/importState (round-trip), structured errors on a bad rollback.
 *
 * @module
 */

import type { Env, HostAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';

/**
 * Duck-type check for AgentryError that works across CJS/ESM module boundaries.
 * The fixture may load @openagentry/core via CJS (require) while the suite loads
 * it via ESM (import), producing two different class objects. instanceof fails
 * across that boundary, so we inspect the error's structural shape instead.
 */
function isAgentryError(value: unknown): value is { code: string; phase: string; name: string } {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    e['name'] === 'AgentryError' &&
    typeof e['code'] === 'string' &&
    typeof e['phase'] === 'string'
  );
}

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

function pass(id: string, durationMs: number, details?: Record<string, unknown>): CheckResult {
  return details === undefined
    ? { id, status: 'pass', durationMs }
    : { id, status: 'pass', durationMs, details };
}

function getAdapter(target: LoadedTarget): HostAdapter | undefined {
  const mod = target.module as { default?: unknown };
  const candidate = mod.default;
  if (candidate === null || typeof candidate !== 'object') return undefined;
  if ((candidate as { category?: string }).category !== 'host') return undefined;
  return candidate as HostAdapter;
}

export const hostSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapter(target);
  if (adapter === undefined) {
    return [
      fail(
        'host/createProject',
        'Adapter default export missing or has wrong category (expected "host").',
        0,
      ),
    ];
  }

  // host/createProject
  const createWrap = await timed(ctx, () =>
    adapter.createProject({ name: 'Conformance Probe', slug: 'conformance-probe' }),
  );
  if (!createWrap.ok || createWrap.result === undefined) {
    checks.push(
      fail(
        'host/createProject',
        `createProject threw: ${(createWrap.err as Error)?.message ?? 'unknown'}`,
        createWrap.durationMs,
      ),
    );
    return checks;
  }
  const project = createWrap.result;
  if (typeof project.hostId !== 'string' || project.hostId.length === 0) {
    checks.push(
      fail(
        'host/createProject',
        'createProject returned a project with no hostId.',
        createWrap.durationMs,
      ),
    );
    return checks;
  }
  checks.push(pass('host/createProject', createWrap.durationMs, { hostId: project.hostId }));

  // host/setEnv-idempotent
  const setEnvWrap = await timed(ctx, async () => {
    const vars = { CONFORMANCE_KEY: 'value-1' };
    await adapter.setEnv(project, vars, 'preview' as Env);
    await adapter.setEnv(project, vars, 'preview' as Env);
  });
  if (setEnvWrap.ok) {
    checks.push(pass('host/setEnv-idempotent', setEnvWrap.durationMs));
  } else {
    checks.push(
      fail(
        'host/setEnv-idempotent',
        `setEnv called twice with same input must succeed both times: ${(setEnvWrap.err as Error)?.message}`,
        setEnvWrap.durationMs,
      ),
    );
  }

  // host/getEnv-roundtrip
  const getEnvWrap = await timed(ctx, () => adapter.getEnv(project, 'preview' as Env));
  if (!getEnvWrap.ok) {
    checks.push(
      fail(
        'host/getEnv-roundtrip',
        `getEnv threw: ${(getEnvWrap.err as Error)?.message}`,
        getEnvWrap.durationMs,
      ),
    );
  } else if (getEnvWrap.result?.['CONFORMANCE_KEY'] !== 'value-1') {
    checks.push(
      fail(
        'host/getEnv-roundtrip',
        `getEnv did not return the value set by setEnv (got ${JSON.stringify(getEnvWrap.result)}).`,
        getEnvWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('host/getEnv-roundtrip', getEnvWrap.durationMs));
  }

  // host/exportState-importState
  const expWrap = await timed(ctx, () => adapter.exportState(project));
  if (!expWrap.ok || expWrap.result === undefined) {
    checks.push(
      fail(
        'host/exportState-importState',
        `exportState threw: ${(expWrap.err as Error)?.message}`,
        expWrap.durationMs,
      ),
    );
  } else {
    const impWrap = await timed(ctx, () => adapter.importState(expWrap.result!));
    if (!impWrap.ok || impWrap.result === undefined) {
      checks.push(
        fail(
          'host/exportState-importState',
          `importState threw: ${(impWrap.err as Error)?.message}`,
          impWrap.durationMs,
        ),
      );
    } else if (impWrap.result.hostId !== project.hostId) {
      checks.push(
        fail(
          'host/exportState-importState',
          `importState returned a project with a different hostId (${impWrap.result.hostId} vs ${project.hostId}).`,
          impWrap.durationMs,
        ),
      );
    } else {
      checks.push(pass('host/exportState-importState', impWrap.durationMs));
    }
  }

  // host/structured-errors — invoke a method with input that must fail and assert AgentryError.
  const seWrap = await timed(ctx, () => adapter.rollback(project, 'definitely-not-a-real-deployment-id'));
  if (seWrap.ok) {
    checks.push(
      fail(
        'host/structured-errors',
        'rollback() with an unknown deploymentId must throw AgentryError, but it resolved successfully.',
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'host/structured-errors',
        `rollback() threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}). All adapter failures must be AgentryError.`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('host/structured-errors', seWrap.durationMs, { code: seWrap.err.code }));
  }

  return checks;
};

registerFunctionalSuite('host', hostSuite);
