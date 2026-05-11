/**
 * Read Cloudflare host adapter configuration from environment variables.
 *
 * Returns a two-branch discriminated union:
 *   ok=true  → required vars present; `config` is ready for createCloudflareHostAdapter.
 *   ok=false → one or more required vars absent; `missing` lists their names.
 *
 * No secret values appear in the error branch — only env-var names.
 *
 * @module
 */

import type { CloudflareApiInput } from './client.js';

const REQUIRED_VARS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const;

export type EnvReadResult =
  | { ok: true; config: CloudflareApiInput }
  | { ok: false; missing: string[] };

/**
 * Read Cloudflare adapter config from the supplied env record.
 *
 * Pass `process.env` in production; pass a plain object in tests.
 * The `missing` array in the `ok=false` branch contains only variable
 * *names*, never their values — safe to log or surface to users.
 */
export function readEnvConfig(env: NodeJS.ProcessEnv): EnvReadResult {
  const missing = REQUIRED_VARS.filter((k) => {
    const v = env[k];
    return v === undefined || v.length === 0;
  });
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return {
    ok: true,
    config: {
      apiToken: env['CLOUDFLARE_API_TOKEN']!,
      accountId: env['CLOUDFLARE_ACCOUNT_ID']!,
    },
  };
}
