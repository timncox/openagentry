/**
 * createInstance / destroyInstance / getInstanceBySlug.
 *
 * Phase strings 'createInstance' and 'destroyInstance' are now part of
 * core's AgentryErrorPhase union (added by Plan H); no cast workaround
 * needed.
 *
 * @module
 */

import {
  AgentryError,
  type AgentryErrorPhase,
  type ConfirmToken,
  type CreateDatabaseOpts,
  type DatabaseInstance,
  type IsoTimestamp,
  type Region,
} from '@openagentry/core';
import type { NeonApi } from '../client.js';
import { ADAPTER_ID, NEON_ERROR_CODES } from '../errors.js';
import type {
  NeonProject,
  NeonProjectCreateResponse,
  NeonProjectsListResponse,
} from '../types.js';

const SLUG_PREFIX = 'oa-';

const PHASE_CREATE: AgentryErrorPhase = 'createInstance';
const PHASE_DESTROY: AgentryErrorPhase = 'destroyInstance';

function projectToInstance(project: NeonProject, slug: string): DatabaseInstance {
  return {
    id: project.id,
    dbId: project.id,
    name: project.name.startsWith(SLUG_PREFIX) ? project.name.slice(SLUG_PREFIX.length) : project.name,
    slug,
    engine: 'postgres',
    region: project.region_id as Region,
    createdAt: project.created_at as IsoTimestamp,
  };
}

export async function getInstanceBySlug(
  api: NeonApi,
  slug: string,
  phase: AgentryErrorPhase,
): Promise<DatabaseInstance | null> {
  const projectName = `${SLUG_PREFIX}${slug}`;
  const result = await api.request<NeonProjectsListResponse>(
    'GET',
    `/projects?search=${encodeURIComponent(projectName)}`,
    { phase },
  );
  const match = (result.projects ?? []).find((p) => p.name === projectName);
  if (match === undefined) return null;
  return projectToInstance(match, slug);
}

export async function createInstance(
  api: NeonApi,
  opts: CreateDatabaseOpts,
): Promise<DatabaseInstance> {
  if (opts.engine !== 'postgres') {
    throw new AgentryError({
      code: NEON_ERROR_CODES.SCHEMA,
      message: `Neon supports only Postgres; got engine="${opts.engine}".`,
      phase: PHASE_CREATE,
      adapter: ADAPTER_ID,
      suggestedFix: 'Pass engine: "postgres" to createInstance.',
    });
  }

  // Idempotency: find by slug first.
  const existing = await getInstanceBySlug(api, opts.slug, PHASE_CREATE);
  if (existing !== null) return existing;

  const region = (opts.region as string | undefined) ?? api.config.defaultRegion;
  const created = await api.request<NeonProjectCreateResponse>('POST', '/projects', {
    phase: PHASE_CREATE,
    json: {
      project: {
        name: `${SLUG_PREFIX}${opts.slug}`,
        region_id: region,
      },
    },
  });

  if (opts.perEnvBranches === true) {
    for (const branchName of ['preview', 'dev']) {
      await api.request('POST', `/projects/${created.project.id}/branches`, {
        phase: PHASE_CREATE,
        json: { branch: { name: branchName } },
      });
    }
  }

  return projectToInstance(created.project, opts.slug);
}

export async function destroyInstance(
  api: NeonApi,
  instance: DatabaseInstance,
  confirm: ConfirmToken,
): Promise<void> {
  const token = confirm as unknown as string;
  if (typeof token !== 'string' || token.length === 0) {
    throw new AgentryError({
      code: NEON_ERROR_CODES.SCHEMA,
      message: 'destroyInstance requires a non-empty ConfirmToken.',
      phase: PHASE_DESTROY,
      adapter: ADAPTER_ID,
      suggestedFix: 'Pass a non-empty string as the ConfirmToken (e.g., "i-am-sure").',
    });
  }
  await api.request('DELETE', `/projects/${instance.dbId}`, {
    phase: PHASE_DESTROY,
  });
}
