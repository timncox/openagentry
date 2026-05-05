/**
 * Database functional conformance suite. Self-registers with the runner.
 *
 * Five checks: createInstance, createInstance-idempotent, connectionString,
 * exportState-importState (round-trip), structured-errors.
 *
 * @module
 */

import type { ConfirmToken, DatabaseAdapter, Env } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { isAgentryError } from '../internal/is-agentry-error.js';
import { timed, fail, pass, getAdapterDefault } from '../internal/suite-helpers.js';

export const dbSuite = async (
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> => {
  const checks: CheckResult[] = [];
  const adapter = getAdapterDefault<DatabaseAdapter>(target, 'db');
  if (adapter === undefined) {
    return [
      fail(
        'db/createInstance',
        'Adapter default export missing or has wrong category (expected "db").',
        0,
      ),
    ];
  }

  // db/createInstance
  const createWrap = await timed(ctx, () =>
    adapter.createInstance({
      name: 'Conformance Probe',
      slug: 'conformance-probe',
      engine: 'postgres',
    }),
  );
  if (!createWrap.ok || createWrap.result === undefined) {
    checks.push(
      fail(
        'db/createInstance',
        `createInstance threw: ${(createWrap.err as Error)?.message ?? 'unknown'}`,
        createWrap.durationMs,
      ),
    );
    return checks;
  }
  const instance = createWrap.result;
  if (typeof instance.dbId !== 'string' || instance.dbId.length === 0) {
    checks.push(
      fail(
        'db/createInstance',
        'createInstance returned an instance with no dbId.',
        createWrap.durationMs,
      ),
    );
    return checks;
  }
  checks.push(pass('db/createInstance', createWrap.durationMs, { dbId: instance.dbId }));

  // db/createInstance-idempotent
  const dupWrap = await timed(ctx, () =>
    adapter.createInstance({
      name: 'Conformance Probe',
      slug: 'conformance-probe',
      engine: 'postgres',
    }),
  );
  if (!dupWrap.ok || dupWrap.result === undefined) {
    checks.push(
      fail(
        'db/createInstance-idempotent',
        `Second createInstance with the same slug threw: ${(dupWrap.err as Error)?.message ?? 'unknown'}`,
        dupWrap.durationMs,
      ),
    );
  } else if (dupWrap.result.dbId !== instance.dbId) {
    checks.push(
      fail(
        'db/createInstance-idempotent',
        `Idempotent createInstance returned a different dbId (${dupWrap.result.dbId} vs ${instance.dbId}).`,
        dupWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('db/createInstance-idempotent', dupWrap.durationMs));
  }

  // db/connectionString
  const csWrap = await timed(ctx, () => adapter.connectionString(instance, 'prod' as Env));
  if (!csWrap.ok || typeof csWrap.result !== 'string') {
    checks.push(
      fail(
        'db/connectionString',
        `connectionString threw: ${(csWrap.err as Error)?.message ?? 'unknown'}`,
        csWrap.durationMs,
      ),
    );
  } else if (!/^postgres(?:ql)?:\/\//.test(csWrap.result)) {
    checks.push(
      fail(
        'db/connectionString',
        `connectionString must return a postgres:// or postgresql:// URI (got "${csWrap.result.slice(0, 40)}").`,
        csWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('db/connectionString', csWrap.durationMs));
  }

  // db/exportState-importState
  const expWrap = await timed(ctx, () => adapter.exportState(instance));
  if (!expWrap.ok || expWrap.result === undefined) {
    checks.push(
      fail(
        'db/exportState-importState',
        `exportState threw: ${(expWrap.err as Error)?.message}`,
        expWrap.durationMs,
      ),
    );
  } else {
    const impWrap = await timed(ctx, () => adapter.importState(expWrap.result!));
    if (!impWrap.ok || impWrap.result === undefined) {
      checks.push(
        fail(
          'db/exportState-importState',
          `importState threw: ${(impWrap.err as Error)?.message}`,
          impWrap.durationMs,
        ),
      );
    } else if (impWrap.result.dbId !== instance.dbId) {
      checks.push(
        fail(
          'db/exportState-importState',
          `importState returned a different dbId (${impWrap.result.dbId} vs ${instance.dbId}).`,
          impWrap.durationMs,
        ),
      );
    } else {
      checks.push(pass('db/exportState-importState', impWrap.durationMs));
    }
  }

  // db/structured-errors — destroyInstance with empty token must throw AgentryError.
  const seWrap = await timed(ctx, () => adapter.destroyInstance(instance, '' as ConfirmToken));
  if (seWrap.ok) {
    checks.push(
      fail(
        'db/structured-errors',
        'destroyInstance with empty ConfirmToken must throw AgentryError, but it resolved successfully.',
        seWrap.durationMs,
      ),
    );
  } else if (!isAgentryError(seWrap.err)) {
    checks.push(
      fail(
        'db/structured-errors',
        `destroyInstance with empty ConfirmToken threw a non-AgentryError (${(seWrap.err as Error)?.constructor?.name ?? typeof seWrap.err}).`,
        seWrap.durationMs,
      ),
    );
  } else {
    checks.push(pass('db/structured-errors', seWrap.durationMs, { code: seWrap.err.code }));
  }

  return checks;
};

registerFunctionalSuite('db', dbSuite);
