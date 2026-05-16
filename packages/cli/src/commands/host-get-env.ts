/**
 * `agentry host:get-env <slug> [--env preview|prod|dev]` — read env vars
 * from the registered HostAdapter.
 *
 * @module
 */

import {
  AgentryError,
  useAdapter,
  type Env,
  type HostAdapter,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
import { defineCommand } from '../command.js';

function parseEnv(raw: unknown): Env {
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'preview') return 'preview';
  if (raw === 'dev' || raw === undefined) return 'dev';
  throw new AgentryError({
    code: 'E_INVALID_ARG',
    message: `Invalid --env "${String(raw)}". Use "dev", "preview", or "prod".`,
    phase: 'init',
    suggestedFix: `agentry host:get-env <slug> --env prod`,
  });
}

export const hostGetEnvCommand = defineCommand({
  name: 'host:get-env',
  summary: 'Read environment variables from a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:get-env <slug> --env prod`,
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

    const vars = await adapter.getEnv(project, env);

    for (const [k, v] of Object.entries(vars)) {
      output.text(`${k}=${v}`);
    }
    output.json({ slug, env, vars });
    return 0;
  },
});
