/**
 * setEnv / getEnv. Idempotent additive merge via per-var Vercel env API.
 *
 * Vercel's env var API requires:
 *   - POST   /v10/projects/{id}/env    to create a new var
 *   - PATCH  /v10/projects/{id}/env/{envVarId}  to update an existing var
 *
 * setEnv: reads existing vars for the given env, then for each (key, value):
 *   - absent  → POST (create)
 *   - same    → skip (idempotent)
 *   - changed → PATCH (update)
 * Vars present in Vercel but not in the `vars` record are left untouched
 * (additive semantics match Plan E's host-cloudflare setEnv).
 *
 * getEnv: GET /v9/projects/{id}/env?decrypt=true, filter by target array.
 *
 * @module
 */

import type { Env, HostProject } from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { vercelFetch } from '../http.js';

// ---------------------------------------------------------------------------
// Env → Vercel target mapping
// ---------------------------------------------------------------------------

/**
 * Maps our Env union to Vercel's target string.
 * Vercel supports 'production', 'preview', 'development'.
 */
function mapEnvToVercelTarget(env: Env): 'production' | 'preview' | 'development' {
  switch (env) {
    case 'prod':
      return 'production';
    case 'preview':
      return 'preview';
    case 'dev':
      return 'development';
  }
}

// ---------------------------------------------------------------------------
// Vercel env var response shape
// ---------------------------------------------------------------------------

interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  type: string;
  target: string[];
}

interface VercelEnvListResponse {
  envs: VercelEnvVar[];
}

// ---------------------------------------------------------------------------
// getEnv
// ---------------------------------------------------------------------------

/**
 * Retrieves env vars for the project filtered to the given environment.
 *
 * GET /v9/projects/{slug}/env?decrypt=true returns decrypted values.
 * We filter by entries whose `target` array includes the mapped Vercel target.
 */
export async function getEnv(
  cfg: VercelHostConfig,
  p: HostProject,
  env: Env,
): Promise<Record<string, string>> {
  const vercelTarget = mapEnvToVercelTarget(env);
  const response = await vercelFetch(
    cfg,
    'GET',
    `/v9/projects/${p.slug}/env?decrypt=true`,
    undefined,
    'getEnv',
  );

  const body = response.json as VercelEnvListResponse;
  const out: Record<string, string> = {};
  for (const entry of body.envs) {
    if (Array.isArray(entry.target) && entry.target.includes(vercelTarget)) {
      out[entry.key] = entry.value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// setEnv
// ---------------------------------------------------------------------------

/**
 * Idempotently sets env vars for the project in the given environment.
 *
 * For each (key, value) in vars:
 *   - Not in Vercel yet → POST /v10/projects/{slug}/env
 *   - Already in Vercel, same value → skip (no HTTP call)
 *   - Already in Vercel, different value → PATCH /v10/projects/{slug}/env/{id}
 *
 * Vars not present in the `vars` record are left untouched (additive merge).
 * Calling setEnv twice with the same vars is a no-op on the second call.
 */
export async function setEnv(
  cfg: VercelHostConfig,
  p: HostProject,
  vars: Record<string, string>,
  env: Env,
): Promise<void> {
  const vercelTarget = mapEnvToVercelTarget(env);

  // Step 1: read existing env vars (decrypt=true for value comparison).
  const response = await vercelFetch(
    cfg,
    'GET',
    `/v9/projects/${p.slug}/env?decrypt=true`,
    undefined,
    'setEnv',
  );

  const body = response.json as VercelEnvListResponse;

  // Build a lookup: key → { id, value } for existing vars in this target.
  const existingByKey = new Map<string, { id: string; value: string }>();
  for (const entry of body.envs) {
    if (Array.isArray(entry.target) && entry.target.includes(vercelTarget)) {
      existingByKey.set(entry.key, { id: entry.id, value: entry.value });
    }
  }

  // Step 2: for each var in the input, create or update as needed.
  for (const [key, value] of Object.entries(vars)) {
    const existing = existingByKey.get(key);
    if (existing === undefined) {
      // New var — POST to create.
      await vercelFetch(
        cfg,
        'POST',
        `/v10/projects/${p.slug}/env`,
        {
          key,
          value,
          type: 'encrypted',
          target: [vercelTarget],
        },
        'setEnv',
      );
    } else if (existing.value !== value) {
      // Existing var with different value — PATCH to update.
      await vercelFetch(
        cfg,
        'PATCH',
        `/v10/projects/${p.slug}/env/${existing.id}`,
        {
          key,
          value,
          type: 'encrypted',
          target: [vercelTarget],
        },
        'setEnv',
      );
    }
    // Same value as existing → skip (no HTTP call).
  }
}
