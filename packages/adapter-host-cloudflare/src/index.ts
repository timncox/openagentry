/**
 * @openagentry/adapter-host-cloudflare — public entry.
 *
 * Default export: an adapter constructed from `process.env.CLOUDFLARE_API_TOKEN`
 * + `process.env.CLOUDFLARE_ACCOUNT_ID`. This is what
 * `@openagentry/adapter-test-suite` resolves at conformance time.
 *
 * Named export: `createCloudflareHostAdapter(input)` for explicit
 * construction (tests, multi-account use).
 *
 * @module
 */

export {
  createCloudflareHostAdapter,
  type CloudflareHostAdapter,
} from './adapter.js';
export {
  cloudflareConfigSchema,
  parseCloudflareConfig,
  type CloudflareConfig,
} from './config.js';
export { ADAPTER_ID, CF_ERROR_CODES } from './errors.js';

import { createCloudflareHostAdapter } from './adapter.js';

const apiToken = process.env['CLOUDFLARE_API_TOKEN'];
const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];

const defaultAdapter =
  apiToken !== undefined && accountId !== undefined
    ? createCloudflareHostAdapter({ apiToken, accountId })
    : null;

export default defaultAdapter;
