import { describe, expectTypeOf, it } from 'vitest';
import type {
  DatabaseAdapter,
  DatabaseInstance,
  DatabaseStateBundle,
  CreateDatabaseOpts,
} from '../../src/adapters/db.js';
import type { ConfirmToken } from '../../src/types.js';

describe('DatabaseAdapter type contract', () => {
  it('declares category="db"', () => {
    expectTypeOf<DatabaseAdapter['category']>().toEqualTypeOf<'db'>();
  });

  it('createInstance takes CreateDatabaseOpts → DatabaseInstance', () => {
    expectTypeOf<DatabaseAdapter['createInstance']>().toEqualTypeOf<
      (opts: CreateDatabaseOpts) => Promise<DatabaseInstance>
    >();
  });

  it('connectionString returns a string for a given env', () => {
    expectTypeOf<DatabaseAdapter['connectionString']>().toEqualTypeOf<
      (i: DatabaseInstance, env: 'preview' | 'prod' | 'dev') => Promise<string>
    >();
  });

  it('exportState produces DatabaseStateBundle', () => {
    expectTypeOf<DatabaseAdapter['exportState']>().toEqualTypeOf<
      (i: DatabaseInstance) => Promise<DatabaseStateBundle>
    >();
  });

  it('destroyInstance requires ConfirmToken', () => {
    expectTypeOf<DatabaseAdapter['destroyInstance']>().toEqualTypeOf<
      (i: DatabaseInstance, confirm: ConfirmToken) => Promise<void>
    >();
  });
});
