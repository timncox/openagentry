/**
 * @openagentry/adapter-db-neon — public exports + lazy default export
 * resolved from NEON_API_KEY.
 *
 * Default export: a frozen DatabaseAdapter whose async methods build (once)
 * from `process.env.NEON_API_KEY` on first call. `category` and `id` are
 * static and never trigger env initialization.
 *
 * Async methods wrap buildFromEnv() in try/catch → Promise.reject so that
 * callers always receive a rejected Promise rather than a synchronous throw
 * when env vars are missing (Plan K bug #2 pattern). Matches the convention
 * used by adapter-repo-github, adapter-host-vercel, etc.
 *
 * `@openagentry/adapter-test-suite` resolves this default at conformance time.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
import type {
  ConfirmToken,
  CreateDatabaseOpts,
  DatabaseAdapter,
  DatabaseInstance,
  DatabaseStateBundle,
  Env,
} from '@openagentry/core';
import { createNeonDatabaseAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { NEON_ERROR_CODES } from './errors.js';

const ADAPTER_ID = 'neon';

// ─── Public named exports ─────────────────────────────────────────────────────

export {
  createNeonDatabaseAdapter,
  type NeonDatabaseAdapter,
} from './adapter.js';
export {
  neonConfigSchema,
  parseNeonConfig,
  type NeonConfig,
} from './config.js';
export { NEON_ERROR_CODES } from './errors.js';

// ─── Lazy default ─────────────────────────────────────────────────────────────

let cached: DatabaseAdapter | undefined;

/**
 * Build a NeonDatabaseAdapter from NEON_API_KEY and memoize the result.
 *
 * Throws a synchronous AgentryError when NEON_API_KEY is missing. The lazy
 * wrapper below converts this sync throw to Promise.reject for async methods.
 */
function buildFromEnv(): DatabaseAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (!result.ok) {
    throw new AgentryError({
      code: NEON_ERROR_CODES.AUTH,
      phase: 'init',
      message: `Missing required env vars for ${ADAPTER_ID}: ${result.missing.join(', ')}`,
      context: { missing: result.missing },
      suggestedFix:
        `Set NEON_API_KEY in your environment before using the default adapter. ` +
        `Alternatively call createNeonDatabaseAdapter({ apiKey }) directly to provide config explicitly.`,
    });
  }
  cached = createNeonDatabaseAdapter(result.config);
  return cached;
}

/**
 * Lazy default DatabaseAdapter. Reads NEON_API_KEY on first async method call
 * and caches the result. `category` and `id` are static.
 */
const lazyAdapter: DatabaseAdapter = Object.freeze({
  category: 'db' as const,
  id: ADAPTER_ID,

  createInstance(opts: CreateDatabaseOpts): Promise<DatabaseInstance> {
    try { return (cached ??= buildFromEnv()).createInstance(opts); }
    catch (err) { return Promise.reject(err); }
  },

  destroyInstance(i: DatabaseInstance, c: ConfirmToken): Promise<void> {
    try { return (cached ??= buildFromEnv()).destroyInstance(i, c); }
    catch (err) { return Promise.reject(err); }
  },

  connectionString(i: DatabaseInstance, env: Env): Promise<string> {
    try { return (cached ??= buildFromEnv()).connectionString(i, env); }
    catch (err) { return Promise.reject(err); }
  },

  exportState(i: DatabaseInstance): Promise<DatabaseStateBundle> {
    try { return (cached ??= buildFromEnv()).exportState(i); }
    catch (err) { return Promise.reject(err); }
  },

  importState(b: DatabaseStateBundle): Promise<DatabaseInstance> {
    try { return (cached ??= buildFromEnv()).importState(b); }
    catch (err) { return Promise.reject(err); }
  },
});

export default lazyAdapter;
