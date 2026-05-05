/**
 * Assemble the HostAdapter from the ops modules + a CloudflareApi instance.
 *
 * @module
 */

import type {
  ConfirmToken,
  CreateProjectOpts,
  Deployment,
  DeployOpts,
  DomainAttachment,
  Env,
  HostAdapter,
  HostProject,
  HostStateBundle,
  LogLine,
  LogOpts,
} from '@openagentry/core';
import { cloudflareApi, type CloudflareApiInput } from './client.js';
import { createProject, destroyProject } from './ops/projects.js';
import { setEnv, getEnv } from './ops/env.js';
import { deploy, rollback } from './ops/deploy.js';
import { attachDomain, detachDomain } from './ops/domains.js';
import { logs } from './ops/logs.js';
import { exportState, importState } from './ops/state.js';

export interface CloudflareHostAdapter extends HostAdapter {
  readonly category: 'host';
  readonly id: 'host-cloudflare';
}

export function createCloudflareHostAdapter(input: CloudflareApiInput): CloudflareHostAdapter {
  const api = cloudflareApi(input);
  const adapter: CloudflareHostAdapter = {
    category: 'host',
    id: 'host-cloudflare',
    createProject: (opts: CreateProjectOpts) => createProject(api, opts),
    destroyProject: (p: HostProject, c: ConfirmToken) => destroyProject(api, p, c),
    deploy: (p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts) =>
      deploy(api, p, env, opts) as Promise<Deployment>,
    rollback: (p: HostProject, id: string) => rollback(api, p, id),
    setEnv: (p: HostProject, vars: Record<string, string>, env: Env) =>
      setEnv(api, p, vars, env),
    getEnv: (p: HostProject, env: Env) => getEnv(api, p, env),
    attachDomain: (p: HostProject, d: string): Promise<DomainAttachment> =>
      attachDomain(api, p, d),
    detachDomain: (p: HostProject, d: string) => detachDomain(api, p, d),
    logs: (p: HostProject, opts?: LogOpts): AsyncIterable<LogLine> => logs(api, p, opts),
    exportState: (p: HostProject): Promise<HostStateBundle> => exportState(api, p),
    importState: (b: HostStateBundle) => importState(api, b),
  };
  return Object.freeze(adapter);
}
