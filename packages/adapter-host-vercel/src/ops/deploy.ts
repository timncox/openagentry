/**
 * deploy / rollback.
 *
 * deploy: git-source only in v0. Reads project metadata to get repoId +
 * productionBranch, then POSTs to /v13/deployments with a gitSource block.
 *
 * rollback: re-promotes a prior deployment to production via the
 * POST /v10/projects/{idOrName}/promote/{deploymentId} endpoint.
 *
 * @module
 */

import type {
  Deployment,
  DeployOpts,
  HostProject,
  IsoTimestamp,
} from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { VERCEL_ERROR_CODES, vercelError } from '../errors.js';
import { vercelFetch } from '../http.js';

// ---------------------------------------------------------------------------
// readyState → Deployment status
// ---------------------------------------------------------------------------

/**
 * Maps a Vercel readyState string to the core Deployment status union.
 *
 * Vercel states observed in practice:
 *   READY         → 'success'
 *   BUILDING      → 'building'
 *   INITIALIZING  → 'building'
 *   QUEUED        → 'building'   (queued in the CI queue, not yet started)
 *   ERROR         → 'failed'
 *   CANCELED      → 'canceled'
 *   <other>       → 'queued'     (defensive default for undocumented future states)
 */
export function mapReadyState(state: string): Deployment['status'] {
  switch (state) {
    case 'READY':
      return 'success';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'building';
    case 'ERROR':
      return 'failed';
    case 'CANCELED':
      return 'canceled';
    default:
      return 'queued';
  }
}

// ---------------------------------------------------------------------------
// Deployment mapper
// ---------------------------------------------------------------------------

/**
 * Maps a Vercel deployment JSON response to the core Deployment interface.
 *
 * Field mapping:
 *   id        ← json.id (or json.uid in some endpoints — both present in /v13)
 *   env       ← json.target ('production' → 'prod', else 'preview')
 *   url       ← json.url
 *   status    ← mapReadyState(json.readyState)
 *   createdAt ← json.createdAt
 *   meta      ← { provider: 'vercel', readyState, target }
 */
export function mapDeployment(json: Record<string, unknown>): Deployment {
  const id = (json['id'] ?? json['uid']) as string;
  const target = json['target'] as string | undefined;
  const readyState = (json['readyState'] ?? 'QUEUED') as string;
  return {
    id,
    env: target === 'production' ? 'prod' : 'preview',
    url: json['url'] as string,
    status: mapReadyState(readyState),
    createdAt: json['createdAt'] as IsoTimestamp,
    meta: {
      provider: 'vercel',
      readyState,
      target: target ?? 'preview',
    },
  };
}

// ---------------------------------------------------------------------------
// deploy
// ---------------------------------------------------------------------------

interface VercelProjectLink {
  repoId: number | string;
  productionBranch?: string;
}

interface VercelProjectMeta {
  link?: VercelProjectLink | null;
}

/**
 * Deploys a Vercel project from its connected git source.
 *
 * Steps:
 *   1. GET /v9/projects/{slug} to read git link (repoId + productionBranch).
 *   2. If link is missing/null → throw E_VERCEL_NO_GIT_LINK.
 *   3. POST /v13/deployments with { name, target, gitSource }.
 *   4. Map response → Deployment.
 *
 * opts.ref defaults to the project's productionBranch when not supplied.
 * env 'preview' → Vercel target 'preview'.
 * env 'prod'    → Vercel target 'production'.
 */
export async function deploy(
  cfg: VercelHostConfig,
  p: HostProject,
  env: 'preview' | 'prod',
  opts?: DeployOpts,
): Promise<Deployment> {
  // Step 1: fetch project to resolve git link.
  const projectResp = await vercelFetch(
    cfg,
    'GET',
    `/v9/projects/${p.slug}`,
    undefined,
    'deploy',
  );
  const projectJson = projectResp.json as VercelProjectMeta;

  const link = projectJson.link;
  if (link == null) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.NO_GIT_LINK,
      phase: 'deploy',
      message: `Project "${p.slug}" has no git link — cannot create a git-source deployment.`,
      suggestedFix:
        'Connect the project to a git repository via the Vercel dashboard or API, then retry.',
    });
  }

  const ref = opts?.ref ?? link.productionBranch ?? 'main';
  const target = env === 'prod' ? 'production' : 'preview';

  const body: Record<string, unknown> = {
    name: p.slug,
    target,
    gitSource: {
      type: 'github',
      ref,
      repoId: String(link.repoId),
    },
  };

  const deployResp = await vercelFetch(
    cfg,
    'POST',
    '/v13/deployments',
    body,
    'deploy',
  );

  return mapDeployment(deployResp.json as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// rollback
// ---------------------------------------------------------------------------

/**
 * Promotes a prior deployment to production (rollback).
 *
 * POST /v10/projects/{idOrName}/promote/{deploymentId}.
 * Vercel re-aliases the project's production URL to the specified deployment.
 * Returns the promoted deployment's current state.
 */
export async function rollback(
  cfg: VercelHostConfig,
  p: HostProject,
  deploymentId: string,
): Promise<Deployment> {
  const resp = await vercelFetch(
    cfg,
    'POST',
    `/v10/projects/${p.slug}/promote/${deploymentId}`,
    {},
    'rollback',
  );

  return mapDeployment(resp.json as Record<string, unknown>);
}
