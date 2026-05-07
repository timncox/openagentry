/**
 * Read GitHub repo adapter configuration from environment variables.
 *
 * Returns a two-branch discriminated union:
 *   ok=true  → all required vars present; `config` is ready to pass to
 *              `parseGithubRepoConfig`.
 *   ok=false → one or more required vars absent; `missing` lists their names.
 *
 * No secret values ever appear in the return object's error branch —
 * only env-var names.
 *
 * @module
 */

import type { GithubRepoConfigInput } from './config.js';

const REQUIRED_VARS = ['OA_GITHUB_TOKEN'] as const;

export type EnvReadResult =
  | { ok: true; config: GithubRepoConfigInput }
  | { ok: false; missing: string[] };

export function readEnvConfig(env: NodeJS.ProcessEnv): EnvReadResult {
  const missing = REQUIRED_VARS.filter((k) => !env[k]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const config: GithubRepoConfigInput = {
    token: env.OA_GITHUB_TOKEN!,
  };

  if (env.OA_GITHUB_ENDPOINT) {
    config.endpoint = env.OA_GITHUB_ENDPOINT;
  }

  return { ok: true, config };
}
