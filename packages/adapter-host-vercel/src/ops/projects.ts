/**
 * createProject / destroyProject.
 *
 * @module
 */

import type {
  ConfirmToken,
  CreateProjectOpts,
  HostProject,
  IsoTimestamp,
} from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { VERCEL_ERROR_CODES, vercelError } from '../errors.js';
import { vercelFetch } from '../http.js';

/**
 * Maps a raw Vercel REST API project object to the core HostProject interface.
 *
 * Field mapping:
 *   id/hostId  ← json.id
 *   name       ← opts.name  (display name supplied by caller)
 *   slug       ← json.name  (Vercel uses `name` as both display identifier and URL slug)
 *   createdAt  ← json.createdAt
 */
function mapProject(
  json: Record<string, unknown>,
  opts: CreateProjectOpts,
): HostProject {
  return {
    id: json['id'] as string,
    hostId: json['id'] as string,
    name: opts.name,
    slug: json['name'] as string,
    createdAt: json['createdAt'] as IsoTimestamp,
  } as HostProject;
}

/**
 * Creates a new Vercel project.
 *
 * POST /v11/projects with body { name: opts.slug, framework: opts.framework }.
 * Vercel uses `name` as the project slug — it must be globally (or team-) unique.
 * On 409 / 422 name conflicts, vercelFetch/vercelError converts to E_VERCEL_INVALID.
 */
export async function createProject(
  cfg: VercelHostConfig,
  opts: CreateProjectOpts,
): Promise<HostProject> {
  const body: Record<string, unknown> = { name: opts.slug };
  if (opts.framework !== undefined) {
    body['framework'] = opts.framework;
  }
  const resp = await vercelFetch(
    cfg,
    'POST',
    '/v11/projects',
    body,
    'createProject',
  );
  return mapProject(resp.json as Record<string, unknown>, opts);
}

/**
 * Destroys a Vercel project by slug.
 *
 * Validates the ConfirmToken before issuing any HTTP request — an empty or
 * non-string token throws E_VERCEL_INVALID with phase 'destroyProject'.
 * Successful deletion returns HTTP 204 (no body).
 */
export async function destroyProject(
  cfg: VercelHostConfig,
  p: HostProject,
  confirm: ConfirmToken,
): Promise<void> {
  const token = confirm as unknown as string;
  if (typeof token !== 'string' || token.length === 0) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.INVALID,
      phase: 'destroyProject',
      message:
        'destroyProject requires a non-empty ConfirmToken to prevent accidental deletion.',
      suggestedFix:
        'Pass a non-empty string as the ConfirmToken to confirm intent to permanently delete the project.',
    });
  }
  await vercelFetch(cfg, 'DELETE', `/v9/projects/${p.slug}`, undefined, 'destroyProject');
}
