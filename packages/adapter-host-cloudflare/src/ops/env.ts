/**
 * setEnv / getEnv. Plain-text env vars only at v0.
 *
 * @module
 */

import { AgentryError, type AgentryErrorPhase, type Env, type HostProject } from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import { CF_ERROR_CODES } from '../errors.js';
import type { CfPagesEnvVar, CfPagesProject } from '../types.js';

const ADAPTER_ID = 'host-cloudflare';

export type CfEnvName = 'preview' | 'production';

export function mapEnvToCfEnv(env: Env, phase: AgentryErrorPhase = 'setEnv'): CfEnvName {
  if (env === 'preview') return 'preview';
  if (env === 'prod') return 'production';
  throw new AgentryError({
    code: CF_ERROR_CODES.SCHEMA,
    message: `Cloudflare Pages does not support env "${env}". Only "preview" and "prod" are accepted at v0.`,
    phase,
    adapter: ADAPTER_ID,
    suggestedFix: 'Use "preview" or "prod" — "dev" is reserved for future Workers/local backing.',
  });
}

export async function setEnv(
  api: CloudflareApi,
  project: HostProject,
  vars: Record<string, string>,
  env: Env,
): Promise<void> {
  const cfEnv = mapEnvToCfEnv(env);
  const current = await api.request<CfPagesProject>(
    'GET',
    `/accounts/{account_id}/pages/projects/${project.slug}`,
    { phase: 'setEnv' },
  );
  const existing = current.deployment_configs?.[cfEnv]?.env_vars ?? {};
  const merged: Record<string, CfPagesEnvVar> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (v !== null && v !== undefined) merged[k] = v;
  }
  for (const [k, v] of Object.entries(vars)) {
    merged[k] = { type: 'plain_text', value: v };
  }
  await api.request<CfPagesProject>(
    'PATCH',
    `/accounts/{account_id}/pages/projects/${project.slug}`,
    {
      phase: 'setEnv',
      json: {
        deployment_configs: {
          [cfEnv]: { env_vars: merged },
        },
      },
    },
  );
}

export async function getEnv(
  api: CloudflareApi,
  project: HostProject,
  env: Env,
): Promise<Record<string, string>> {
  const cfEnv = mapEnvToCfEnv(env, 'getEnv');
  const cf = await api.request<CfPagesProject>(
    'GET',
    `/accounts/{account_id}/pages/projects/${project.slug}`,
    { phase: 'getEnv' },
  );
  const env_vars = cf.deployment_configs?.[cfEnv]?.env_vars ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env_vars)) {
    if (v === null || v === undefined) continue;
    if (v.type === 'plain_text') out[k] = v.value;
  }
  return out;
}
