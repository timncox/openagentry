/**
 * exportState / importState. importState is idempotent.
 *
 * @module
 */

import type {
  Env,
  HostProject,
  HostStateBundle,
} from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import { getEnv, setEnv } from './env.js';
import { attachDomain } from './domains.js';
import { createProject, getProjectByName } from './projects.js';
import type { CfPagesProject } from '../types.js';

export async function exportState(
  api: CloudflareApi,
  project: HostProject,
): Promise<HostStateBundle> {
  const previewEnv = await getEnv(api, project, 'preview' as Env);
  const prodEnv = await getEnv(api, project, 'prod' as Env);
  const cf = await api.request<CfPagesProject>(
    'GET',
    `/accounts/{account_id}/pages/projects/${project.slug}`,
    { phase: 'export' },
  );
  const domains = (cf.domains ?? []).filter((d) => !d.endsWith('.pages.dev')).concat(
    (cf.domains ?? []).filter((d) => d.endsWith('.pages.dev')),
  );
  return {
    version: 1,
    hostProject: project,
    env: {
      preview: previewEnv,
      prod: prodEnv,
      dev: {},
    },
    domains,
  };
}

export async function importState(
  api: CloudflareApi,
  bundle: HostStateBundle,
): Promise<HostProject> {
  const slug = bundle.hostProject.slug;
  const existing = await getProjectByName(api, slug, 'import');
  if (existing !== null) {
    return existing;
  }
  const meta = (bundle.hostProject as unknown as { meta?: Record<string, unknown> }).meta;
  const created = await createProject(api, {
    name: bundle.hostProject.name,
    slug,
    ...(meta !== undefined ? { meta } : {}),
  });
  const envs = ['preview', 'prod'] as const;
  for (const e of envs) {
    const vars = bundle.env[e];
    if (vars !== undefined && Object.keys(vars).length > 0) {
      await setEnv(api, created, vars, e);
    }
  }
  for (const d of bundle.domains) {
    if (d.endsWith('.pages.dev')) continue;
    await attachDomain(api, created, d);
  }
  return created;
}
