/**
 * Read Neon database adapter configuration from environment variables.
 *
 * Returns a two-branch discriminated union:
 *   ok=true  → required vars present; `config` ready for createNeonDatabaseAdapter.
 *   ok=false → one or more required vars absent; `missing` lists their names.
 *
 * No secret values appear in the error branch — only env-var names.
 *
 * @module
 */

import type { NeonApiInput } from './client.js';

const REQUIRED_VARS = ['NEON_API_KEY'] as const;

export type EnvReadResult =
  | { ok: true; config: NeonApiInput }
  | { ok: false; missing: string[] };

/**
 * Read Neon adapter config from the supplied env record.
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
  return { ok: true, config: { apiKey: env['NEON_API_KEY']! } };
}
