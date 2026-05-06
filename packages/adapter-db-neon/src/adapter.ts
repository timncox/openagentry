/**
 * Assemble the DatabaseAdapter from the ops modules + a NeonApi instance.
 *
 * @module
 */

import type {
  ConfirmToken,
  CreateDatabaseOpts,
  DatabaseAdapter,
  DatabaseInstance,
  DatabaseStateBundle,
  Env,
} from '@openagentry/core';
import { neonApi, type NeonApiInput } from './client.js';
import { createInstance, destroyInstance } from './ops/instances.js';
import { connectionString } from './ops/connections.js';
import { exportState, importState } from './ops/state.js';

export interface NeonDatabaseAdapter extends DatabaseAdapter {
  readonly category: 'db';
  readonly id: 'neon';
}

export function createNeonDatabaseAdapter(input: NeonApiInput): NeonDatabaseAdapter {
  const api = neonApi(input);
  const adapter: NeonDatabaseAdapter = {
    category: 'db',
    id: 'neon',
    createInstance: (opts: CreateDatabaseOpts) => createInstance(api, opts),
    destroyInstance: (inst: DatabaseInstance, c: ConfirmToken) => destroyInstance(api, inst, c),
    connectionString: (inst: DatabaseInstance, env: Env) => connectionString(api, inst, env),
    exportState: (inst: DatabaseInstance) => exportState(api, inst),
    importState: (b: DatabaseStateBundle) => importState(api, b),
  };
  return Object.freeze(adapter);
}
