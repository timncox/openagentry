/**
 * `agentry host:set-env <slug> KEY=value... [--env preview|prod|dev]` —
 * write env vars to the registered HostAdapter.
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
    suggestedFix: `agentry host:set-env <slug> KEY=value --env prod`,
  });
}

function parsePairs(pairs: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    const eq = p.indexOf('=');
    if (eq <= 0) {
      throw new AgentryError({
        code: 'E_INVALID_ARG',
        message: `Malformed env pair "${p}". Expected KEY=value.`,
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> DATABASE_URL=postgres://...`,
      });
    }
    out[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return out;
}

export const hostSetEnvCommand = defineCommand({
  name: 'host:set-env',
  summary: 'Set environment variables on a project via the registered host adapter.',
  async run(args, output) {
    const [slug, ...pairs] = args.positional;
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> KEY=value [--env prod]`,
      });
    }
    if (pairs.length === 0) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'No KEY=value pairs supplied.',
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> KEY=value`,
      });
    }
    const env = parseEnv(args.flags['env']);
    const vars = parsePairs(pairs);
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

    await adapter.setEnv(project, vars, env);

    output.text(`Set ${Object.keys(vars).length} var(s) on ${slug} (${env}).`);
    output.json({ slug, env, keys: Object.keys(vars) });
    return 0;
  },
});
