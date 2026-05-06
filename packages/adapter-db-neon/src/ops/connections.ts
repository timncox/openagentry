/**
 * connectionString — fetches the Neon connection URI for the branch
 * corresponding to the requested env.
 *
 * Phase string 'connectionString' is not in core's AgentryErrorPhase union;
 * we cast at the module level (Plan E-style workaround).
 *
 * @module
 */

import {
  AgentryError,
  type AgentryErrorPhase,
  type DatabaseInstance,
  type Env,
} from '@openagentry/core';
import type { NeonApi } from '../client.js';
import { ADAPTER_ID, NEON_ERROR_CODES } from '../errors.js';
import type { NeonBranchListResponse, NeonConnectionUriResponse } from '../types.js';

const PHASE = 'connectionString' as AgentryErrorPhase;

function envToBranchName(env: Env): 'main' | 'preview' | 'dev' {
  switch (env) {
    case 'prod':
      return 'main';
    case 'preview':
      return 'preview';
    case 'dev':
      return 'dev';
    default:
      throw new AgentryError({
        code: NEON_ERROR_CODES.SCHEMA,
        message: `Unknown env "${String(env)}". Use one of: prod, preview, dev.`,
        phase: PHASE,
        adapter: ADAPTER_ID,
      });
  }
}

export async function connectionString(
  api: NeonApi,
  instance: DatabaseInstance,
  env: Env,
): Promise<string> {
  const targetName = envToBranchName(env);
  const branchList = await api.request<NeonBranchListResponse>(
    'GET',
    `/projects/${instance.dbId}/branches`,
    { phase: PHASE },
  );
  const branch = (branchList.branches ?? []).find((b) => b.name === targetName);
  if (branch === undefined) {
    throw new AgentryError({
      code: NEON_ERROR_CODES.NOT_FOUND,
      message: `Neon project ${instance.dbId} has no branch named "${targetName}".`,
      phase: PHASE,
      adapter: ADAPTER_ID,
      suggestedFix:
        env === 'prod'
          ? 'The default Neon branch should be named "main"; verify the project was created via createInstance.'
          : `Pass perEnvBranches: true to createInstance to provision the "${targetName}" branch, or attach an existing branch with that name.`,
    });
  }
  const result = await api.request<NeonConnectionUriResponse>(
    'GET',
    `/projects/${instance.dbId}/connection_uri?branch_id=${encodeURIComponent(branch.id)}&database_name=neondb&role_name=neondb_owner&pooled=true`,
    { phase: PHASE },
  );
  return result.uri;
}
