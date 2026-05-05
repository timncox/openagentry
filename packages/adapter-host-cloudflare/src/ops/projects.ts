/**
 * createProject / destroyProject / getProjectByName.
 *
 * @module
 */

import {
  AgentryError,
  isAgentryError,
  type AgentryErrorPhase,
  type ConfirmToken,
  type CreateProjectOpts,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import { CF_ERROR_CODES } from '../errors.js';
import type { CfPagesProject } from '../types.js';

const ADAPTER_ID = 'host-cloudflare';
const DUP_PROJECT_CODE = 8000007;

function projectFromCf(cf: CfPagesProject, opts?: CreateProjectOpts): HostProject {
  const meta = opts?.meta !== undefined ? { ...opts.meta } : undefined;
  return {
    id: cf.id,
    hostId: cf.id,
    name: opts?.name ?? cf.name,
    slug: cf.name,
    createdAt: cf.created_on as IsoTimestamp,
    ...(meta !== undefined ? { meta } : {}),
  } as HostProject;
}

export async function createProject(
  api: CloudflareApi,
  opts: CreateProjectOpts,
): Promise<HostProject> {
  const body = {
    name: opts.slug,
    production_branch: 'main',
  };
  try {
    const cf = await api.request<CfPagesProject>('POST', '/accounts/{account_id}/pages/projects', {
      phase: 'createProject',
      json: body,
    });
    const project = projectFromCf(cf, opts);
    return persistMeta(project, opts);
  } catch (err) {
    if (isAgentryError(err) && err.context?.['cf_code'] === DUP_PROJECT_CODE) {
      const existing = await getProjectByName(api, opts.slug, 'createProject');
      if (existing === null) {
        throw new AgentryError({
          code: CF_ERROR_CODES.PAGES_API,
          message: `Cloudflare reported project "${opts.slug}" already exists, but a follow-up GET returned 404.`,
          phase: 'createProject',
          adapter: ADAPTER_ID,
        });
      }
      return persistMeta(existing, opts);
    }
    throw err;
  }
}

function persistMeta(project: HostProject, opts: CreateProjectOpts): HostProject {
  if (opts.meta === undefined) return project;
  return { ...project, meta: { ...(project.meta ?? {}), ...opts.meta } } as HostProject;
}

export async function destroyProject(
  api: CloudflareApi,
  project: HostProject,
  confirm: ConfirmToken,
): Promise<void> {
  if (typeof confirm !== 'string' || confirm.length === 0) {
    throw new AgentryError({
      code: CF_ERROR_CODES.HTTP,
      message: 'destroyProject requires a non-empty ConfirmToken to proceed.',
      phase: 'destroyProject',
      adapter: ADAPTER_ID,
      suggestedFix:
        'Pass a non-empty string as the ConfirmToken to confirm intent to delete the project.',
    });
  }
  await api.request<unknown>('DELETE', `/accounts/{account_id}/pages/projects/${project.slug}`, {
    phase: 'destroyProject',
  });
}

export async function getProjectByName(
  api: CloudflareApi,
  slug: string,
  phase: AgentryErrorPhase,
): Promise<HostProject | null> {
  try {
    const cf = await api.request<CfPagesProject>(
      'GET',
      `/accounts/{account_id}/pages/projects/${slug}`,
      { phase },
    );
    return projectFromCf(cf);
  } catch (err) {
    if (isAgentryError(err) && err.code === CF_ERROR_CODES.NOT_FOUND) {
      return null;
    }
    throw err;
  }
}
