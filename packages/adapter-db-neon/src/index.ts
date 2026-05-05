/**
 * @openagentry/adapter-db-neon — public entry.
 *
 * Default export: an adapter constructed from `process.env.NEON_API_KEY`.
 * `@openagentry/adapter-test-suite` resolves this default at conformance time.
 *
 * Named export: `createNeonDatabaseAdapter(input)` for explicit construction
 * (tests, multi-account use).
 *
 * @module
 */

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

import { createNeonDatabaseAdapter } from './adapter.js';

const apiKey = process.env['NEON_API_KEY'];

const defaultAdapter =
  apiKey !== undefined && apiKey.length > 0
    ? createNeonDatabaseAdapter({ apiKey })
    : null;

export default defaultAdapter;
