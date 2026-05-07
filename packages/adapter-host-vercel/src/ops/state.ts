/**
 * exportState / importState.
 *
 * @module
 */

import type { Env, HostProject, HostStateBundle } from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { VERCEL_ERROR_CODES, vercelError } from '../errors.js';
import { vercelFetch } from '../http.js';
import { getEnv, setEnv } from './env.js';
import { attachDomain } from './domains.js';
import { createProject } from './projects.js';

/** Minimal Vercel domain list item. */
interface VercelDomainListItem {
  name: string;
}

/** Response from GET /v9/projects/{idOrName}/domains */
interface VercelDomainListResponse {
  domains: VercelDomainListItem[];
}

// ---------------------------------------------------------------------------
// exportState
// ---------------------------------------------------------------------------

export async function exportState(
  cfg: VercelHostConfig,
  p: HostProject,
): Promise<HostStateBundle> {
  // Fetch all 3 envs and the domain list in parallel.
  const [previewEnv, prodEnv, devEnv, domainsResp] = await Promise.all([
    getEnv(cfg, p, 'preview' as Env),
    getEnv(cfg, p, 'prod' as Env),
    getEnv(cfg, p, 'dev' as Env),
    vercelFetch(
      cfg,
      'GET',
      `/v9/projects/${p.slug}/domains`,
      undefined,
      'export',
    ),
  ]);

  const domainsBody = domainsResp.json as VercelDomainListResponse;
  const domainNames = (domainsBody.domains ?? []).map((d) => d.name);

  return {
    version: 1,
    hostProject: p,
    env: {
      preview: previewEnv,
      prod: prodEnv,
      dev: devEnv,
    },
    domains: domainNames,
  };
}

// ---------------------------------------------------------------------------
// importState
// ---------------------------------------------------------------------------

function validateBundle(bundle: unknown): asserts bundle is HostStateBundle {
  if (bundle === null || typeof bundle !== 'object') {
    throw vercelError({
      code: VERCEL_ERROR_CODES.BAD_STATE,
      phase: 'import',
      message: 'State bundle must be a non-null object.',
      suggestedFix: 'Provide a valid HostStateBundle produced by exportState.',
    });
  }
  const b = bundle as Record<string, unknown>;

  if (b['version'] !== 1) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.BAD_STATE,
      phase: 'import',
      message: `Unsupported state bundle version: ${JSON.stringify(b['version'])}. Expected 1.`,
      suggestedFix:
        'Only version 1 bundles are supported. Re-export the state from a compatible adapter version.',
    });
  }
  if (
    b['hostProject'] === null ||
    typeof b['hostProject'] !== 'object' ||
    typeof (b['hostProject'] as Record<string, unknown>)['slug'] !== 'string' ||
    typeof (b['hostProject'] as Record<string, unknown>)['name'] !== 'string'
  ) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.BAD_STATE,
      phase: 'import',
      message:
        'State bundle is missing required field: hostProject.slug / hostProject.name.',
      suggestedFix:
        'Ensure the bundle contains a valid hostProject with both slug and name fields.',
    });
  }
  if (b['env'] === null || typeof b['env'] !== 'object') {
    throw vercelError({
      code: VERCEL_ERROR_CODES.BAD_STATE,
      phase: 'import',
      message: 'State bundle is missing required field: env.',
      suggestedFix: 'The env field must be an object with preview, prod, and dev keys.',
    });
  }
  if (!Array.isArray(b['domains'])) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.BAD_STATE,
      phase: 'import',
      message: 'State bundle is missing required field: domains (must be an array).',
      suggestedFix: 'The domains field must be an array of domain name strings.',
    });
  }
}

export async function importState(
  cfg: VercelHostConfig,
  bundle: HostStateBundle,
): Promise<HostProject> {
  // Validate schema first — throws E_VERCEL_BAD_STATE on mismatch.
  validateBundle(bundle);

  // Create the project.
  const newProject = await createProject(cfg, {
    name: bundle.hostProject.name,
    slug: bundle.hostProject.slug,
  });

  // Restore env vars for all 3 scopes (sequential to respect API rate limits).
  const envKeys: Env[] = ['preview', 'prod', 'dev'];
  for (const envKey of envKeys) {
    const vars = bundle.env[envKey];
    if (vars !== undefined && Object.keys(vars).length > 0) {
      await setEnv(cfg, newProject, vars, envKey);
    }
  }

  // Re-attach domains — best-effort: swallow individual failures and continue.
  for (const domain of bundle.domains) {
    try {
      await attachDomain(cfg, newProject, domain);
    } catch {
      // Domain attach failure is non-fatal during import.
      // DNS verification is external; the record is noted and re-verifiable later.
    }
  }

  return newProject;
}
