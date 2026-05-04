/**
 * DatabaseAdapter — provisions and manages databases (Postgres, MySQL,
 * SQLite, etc.).
 *
 * @module
 */

import type { ConfirmToken, Env, Project, Region } from '../types.js';

export interface DatabaseInstance extends Project {
  /** Provider-specific instance identifier. */
  dbId: string;
  /** Database engine, e.g. "postgres", "mysql", "sqlite". */
  engine: string;
  /** Region the database lives in. */
  region: Region;
}

export interface CreateDatabaseOpts {
  name: string;
  slug: string;
  engine: string;
  region?: Region;
  /** If true, also create per-env branch DBs. */
  perEnvBranches?: boolean;
}

export interface DatabaseStateBundle {
  version: 1;
  instance: DatabaseInstance;
  /** Snapshot URL or inline pg_dump output reference. Vendor-specific. */
  snapshotRef: string;
}

export interface DatabaseAdapter {
  readonly category: 'db';
  readonly id: string;

  createInstance(opts: CreateDatabaseOpts): Promise<DatabaseInstance>;
  destroyInstance(i: DatabaseInstance, confirm: ConfirmToken): Promise<void>;

  connectionString(i: DatabaseInstance, env: Env): Promise<string>;

  exportState(i: DatabaseInstance): Promise<DatabaseStateBundle>;
  importState(bundle: DatabaseStateBundle): Promise<DatabaseInstance>;
}
