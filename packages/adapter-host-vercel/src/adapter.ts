/**
 * Vercel HostAdapter factory. Returns a frozen object implementing the core
 * HostAdapter interface. Each method delegates to the corresponding op function.
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
import {
  parseVercelHostConfig,
  type VercelHostConfig,
  type VercelHostConfigInput,
} from './config.js';
import { ADAPTER_ID } from './errors.js';
import { createProject, destroyProject } from './ops/projects.js';
import { deploy, rollback } from './ops/deploy.js';
import { setEnv, getEnv } from './ops/env.js';
import { attachDomain, detachDomain } from './ops/domains.js';
import { logs } from './ops/logs.js';
import { exportState, importState } from './ops/state.js';

export function createVercelHostAdapter(input: VercelHostConfigInput): HostAdapter {
  const cfg: VercelHostConfig = parseVercelHostConfig(input);

  return Object.freeze({
    category: 'host' as const,
    id: ADAPTER_ID,

    createProject(opts: CreateProjectOpts): Promise<HostProject> {
      return createProject(cfg, opts);
    },

    destroyProject(p: HostProject, confirm: ConfirmToken): Promise<void> {
      return destroyProject(cfg, p, confirm);
    },

    deploy(p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts): Promise<Deployment> {
      return deploy(cfg, p, env, opts);
    },

    rollback(p: HostProject, deploymentId: string): Promise<Deployment> {
      return rollback(cfg, p, deploymentId);
    },

    setEnv(p: HostProject, vars: Record<string, string>, env: Env): Promise<void> {
      return setEnv(cfg, p, vars, env);
    },

    getEnv(p: HostProject, env: Env): Promise<Record<string, string>> {
      return getEnv(cfg, p, env);
    },

    attachDomain(p: HostProject, domain: string): Promise<DomainAttachment> {
      return attachDomain(cfg, p, domain);
    },

    detachDomain(p: HostProject, domain: string): Promise<void> {
      return detachDomain(cfg, p, domain);
    },

    // logs returns AsyncIterable directly — NOT a Promise. The factory calls the
    // op and returns the iterator; callers consume it with `for await`.
    logs(p: HostProject, opts?: LogOpts): AsyncIterable<LogLine> {
      return logs(cfg, p, opts);
    },

    exportState(p: HostProject): Promise<HostStateBundle> {
      return exportState(cfg, p);
    },

    importState(bundle: HostStateBundle): Promise<HostProject> {
      return importState(cfg, bundle);
    },
  });
}
