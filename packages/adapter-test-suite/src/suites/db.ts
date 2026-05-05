/**
 * Database functional conformance suite. Self-registers with the runner.
 *
 * Five checks: createInstance, createInstance-idempotent, connectionString,
 * exportState-importState (round-trip), structured-errors.
 *
 * @module
 */

import type { DatabaseAdapter } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';
import { registerFunctionalSuite } from '../runner.js';
import { fail, getAdapterDefault } from '../internal/suite-helpers.js';

export const dbSuite = async (
  target: LoadedTarget,
  _ctx: SuiteCtx,
): Promise<CheckResult[]> => {
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
  // Functional checks come in Task 3.
  return [];
};

registerFunctionalSuite('db', dbSuite);
