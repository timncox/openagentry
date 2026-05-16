// packages/cli/tests/fixtures/fake-host-adapter.ts
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
  IsoTimestamp,
  LogLine,
  LogOpts,
} from '@openagentry/core';

function isoNow(): IsoTimestamp {
  return new Date().toISOString() as IsoTimestamp;
}

export interface FakeHostState {
  projects: Map<string, HostProject>;
  env: Map<string, Record<Env, Record<string, string>>>;
  domains: Map<string, DomainAttachment[]>;
  deployments: Deployment[];
  logs: LogLine[];
}

export function createFakeHostAdapter(initial?: Partial<FakeHostState>): {
  adapter: HostAdapter;
  state: FakeHostState;
} {
  const state: FakeHostState = {
    projects: initial?.projects ?? new Map(),
    env: initial?.env ?? new Map(),
    domains: initial?.domains ?? new Map(),
    deployments: initial?.deployments ?? [],
    logs: initial?.logs ?? [],
  };

  const adapter: HostAdapter = Object.freeze({
    category: 'host' as const,
    id: 'host-fake',

    async createProject(opts: CreateProjectOpts): Promise<HostProject> {
      const project: HostProject = {
        id: `proj_${opts.slug}`,
        slug: opts.slug,
        name: opts.name,
        createdAt: isoNow(),
        hostId: `host_${opts.slug}`,
      };
      state.projects.set(opts.slug, project);
      return project;
    },

    async destroyProject(_p: HostProject, _confirm: ConfirmToken): Promise<void> {
      state.projects.delete(_p.slug);
    },

    async deploy(p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts): Promise<Deployment> {
      const dep: Deployment = {
        id: `dep_${state.deployments.length + 1}`,
        env,
        url: `https://${p.slug}-${env}.example.com`,
        status: 'success',
        createdAt: isoNow(),
        meta: { projectId: p.id, ref: opts?.ref ?? 'HEAD' },
      };
      state.deployments.push(dep);
      return dep;
    },

    async rollback(p: HostProject, deploymentId: string): Promise<Deployment> {
      const found = state.deployments.find((d) => d.id === deploymentId);
      if (!found) throw new Error(`Deployment ${deploymentId} not found`);
      return found;
    },

    async setEnv(p: HostProject, vars: Record<string, string>, env: Env): Promise<void> {
      const current = state.env.get(p.slug) ?? ({} as Record<Env, Record<string, string>>);
      current[env] = { ...(current[env] ?? {}), ...vars };
      state.env.set(p.slug, current);
    },

    async getEnv(p: HostProject, env: Env): Promise<Record<string, string>> {
      return state.env.get(p.slug)?.[env] ?? {};
    },

    async attachDomain(p: HostProject, domain: string): Promise<DomainAttachment> {
      const attachment: DomainAttachment = { domain, status: 'active' };
      const existing = state.domains.get(p.slug) ?? [];
      existing.push(attachment);
      state.domains.set(p.slug, existing);
      return attachment;
    },

    async detachDomain(p: HostProject, domain: string): Promise<void> {
      const existing = state.domains.get(p.slug) ?? [];
      state.domains.set(
        p.slug,
        existing.filter((d) => d.domain !== domain),
      );
    },

    async *logs(_p: HostProject, _opts?: LogOpts): AsyncIterable<LogLine> {
      for (const line of state.logs) yield line;
    },

    async exportState(p: HostProject): Promise<HostStateBundle> {
      return {
        version: 1,
        hostProject: p,
        env: (state.env.get(p.slug) ?? {}) as Record<Env, Record<string, string>>,
        domains: (state.domains.get(p.slug) ?? []).map((d) => d.domain),
      };
    },

    async importState(bundle: HostStateBundle): Promise<HostProject> {
      state.projects.set(bundle.hostProject.slug, bundle.hostProject);
      state.env.set(bundle.hostProject.slug, bundle.env);
      state.domains.set(
        bundle.hostProject.slug,
        bundle.domains.map((d) => ({ domain: d, status: 'active' })),
      );
      return bundle.hostProject;
    },
  });

  return { adapter, state };
}
