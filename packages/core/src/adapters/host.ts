/**
 * HostAdapter — provisions, deploys, and manages projects on a hosting
 * provider (Cloudflare, Vercel, AWS, GCP, etc.).
 *
 * @module
 */

import type {
  ConfirmToken,
  Deployment,
  Env,
  LogLine,
  Project,
  Region,
} from '../types.js';

export interface HostProject extends Project {
  /** Provider-specific project identifier. */
  hostId: string;
  /** Regions where this project is deployed (if relevant). */
  regions?: Region[];
}

export interface CreateProjectOpts {
  name: string;
  slug: string;
  framework?: string;
  regions?: Region[];
  /** Free-form provider-specific options. */
  meta?: Record<string, unknown>;
}

export interface DeployOpts {
  /** Source ref (commit SHA, branch). If omitted, deploys current source. */
  ref?: string;
  /** If true, skips post-deploy smoke tests. */
  skipChecks?: boolean;
}

export interface LogOpts {
  /** If true, follow logs continuously. */
  tail?: boolean;
  /** Filter by deployment id. */
  deploymentId?: string;
  /** Earliest log timestamp to include (ISO). */
  since?: string;
}

export interface DomainAttachment {
  domain: string;
  status: 'pending' | 'active' | 'failed';
  /** DNS records the user must configure for verification, if any. */
  pendingRecords?: Array<{
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX';
    name: string;
    value: string;
    priority?: number;
  }>;
}

export interface HostStateBundle {
  version: 1;
  hostProject: HostProject;
  env: Record<Env, Record<string, string>>;
  domains: string[];
}

export interface HostAdapter {
  readonly category: 'host';
  readonly id: string;

  createProject(opts: CreateProjectOpts): Promise<HostProject>;
  destroyProject(p: HostProject, confirm: ConfirmToken): Promise<void>;

  deploy(p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts): Promise<Deployment>;
  rollback(p: HostProject, deploymentId: string): Promise<Deployment>;

  setEnv(p: HostProject, vars: Record<string, string>, env: Env): Promise<void>;
  getEnv(p: HostProject, env: Env): Promise<Record<string, string>>;

  attachDomain(p: HostProject, domain: string): Promise<DomainAttachment>;
  detachDomain(p: HostProject, domain: string): Promise<void>;

  logs(p: HostProject, opts?: LogOpts): AsyncIterable<LogLine>;

  exportState(p: HostProject): Promise<HostStateBundle>;
  importState(bundle: HostStateBundle): Promise<HostProject>;
}
