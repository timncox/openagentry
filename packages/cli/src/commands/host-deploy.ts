/**
 * `agentry host:deploy <project-slug> [--env preview|prod]` — deploy via
 * the registered HostAdapter.
 *
 * @module
 */

import {
  AgentryError,
  useAdapter,
  type HostAdapter,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
import { defineCommand } from '../command.js';

function parseEnv(raw: unknown): 'preview' | 'prod' {
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'preview' || raw === undefined) return 'preview';
  throw new AgentryError({
    code: 'E_INVALID_ARG',
    message: `Invalid --env "${String(raw)}". Use "preview" or "prod".`,
    phase: 'init',
    suggestedFix: `agentry host:deploy <slug> --env preview`,
  });
}

export const hostDeployCommand = defineCommand({
  name: 'host:deploy',
  summary: 'Deploy a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:deploy <project-slug> --env preview|prod`,
      });
    }
    const env = parseEnv(args.flags['env']);
    const adapter = useAdapter<HostAdapter>('host');

    // Minimal HostProject reconstructed from the slug. Adapters that need
    // richer state can resolve from slug internally. v2 will persist
    // project metadata (see plan "Known v1 limitations").
    const project: HostProject = {
      id: `proj_${slug}`,
      slug,
      name: slug,
      hostId: `host_${slug}`,
      createdAt: new Date(0).toISOString() as IsoTimestamp,
    };

    const deployment = await adapter.deploy(project, env);

    output.text(`Deployed ${slug} to ${env}: ${deployment.url ?? deployment.id}`);
    output.json({
      slug,
      env,
      deploymentId: deployment.id,
      url: deployment.url,
      status: deployment.status,
    });
    return 0;
  },
});
