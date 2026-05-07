/**
 * Read Vercel host adapter configuration from environment variables.
 *
 * Returns a two-branch discriminated union:
 *   ok=true  → all required vars present; `config` is ready to pass to
 *              `parseVercelHostConfig`.
 *   ok=false → one or more required vars absent; `missing` lists their names.
 *
 * No secret values ever appear in the return object's error branch —
 * only env-var names.
 *
 * @module
 */

import type { VercelHostConfigInput } from './config.js';

const REQUIRED_VARS = ['OA_VERCEL_TOKEN'] as const;

export type EnvReadResult =
  | { ok: true; config: VercelHostConfigInput }
  | { ok: false; missing: string[] };

/**
 * Read Vercel adapter config from the supplied env record.
 *
 * Pass `process.env` in production; pass a plain object in tests.
 * The `missing` array in the `ok=false` branch contains only variable
 * *names*, never their values — safe to log or surface to users.
 */
export function readEnvConfig(env: NodeJS.ProcessEnv): EnvReadResult {
  const missing = REQUIRED_VARS.filter((k) => !env[k]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const config: VercelHostConfigInput = {
    token: env.OA_VERCEL_TOKEN!,
  };

  if (env.OA_VERCEL_TEAM_ID) {
    config.teamId = env.OA_VERCEL_TEAM_ID;
  }

  if (env.OA_VERCEL_ENDPOINT) {
    config.endpoint = env.OA_VERCEL_ENDPOINT;
  }

  return { ok: true, config };
}
