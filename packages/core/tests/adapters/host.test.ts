import { describe, expectTypeOf, it } from 'vitest';
import type {
  HostAdapter,
  HostProject,
  HostStateBundle,
  CreateProjectOpts,
  DeployOpts,
  LogOpts,
  DomainAttachment,
} from '../../src/adapters/host.js';
import type { Project, Deployment, ConfirmToken, Env, LogLine } from '../../src/types.js';

describe('HostAdapter type contract', () => {
  it('HostProject extends Project with optional regions', () => {
    expectTypeOf<HostProject>().toMatchTypeOf<Project>();
    expectTypeOf<HostProject>().toHaveProperty('hostId');
  });

  it('HostStateBundle has version, hostProject, and exported metadata', () => {
    expectTypeOf<HostStateBundle>().toEqualTypeOf<{
      version: 1;
      hostProject: HostProject;
      env: Record<Env, Record<string, string>>;
      domains: string[];
    }>();
  });

  it('HostAdapter declares category="host" and id', () => {
    expectTypeOf<HostAdapter['category']>().toEqualTypeOf<'host'>();
    expectTypeOf<HostAdapter['id']>().toBeString();
  });

  it('createProject takes CreateProjectOpts → Promise<HostProject>', () => {
    expectTypeOf<HostAdapter['createProject']>().toEqualTypeOf<
      (opts: CreateProjectOpts) => Promise<HostProject>
    >();
  });

  it('destroyProject requires a ConfirmToken', () => {
    expectTypeOf<HostAdapter['destroyProject']>().toEqualTypeOf<
      (p: HostProject, confirm: ConfirmToken) => Promise<void>
    >();
  });

  it('deploy takes (project, env, opts?) → Promise<Deployment>', () => {
    expectTypeOf<HostAdapter['deploy']>().toEqualTypeOf<
      (p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts) => Promise<Deployment>
    >();
  });

  it('logs returns AsyncIterable<LogLine>', () => {
    expectTypeOf<ReturnType<HostAdapter['logs']>>().toEqualTypeOf<AsyncIterable<LogLine>>();
  });

  it('exportState/importState round-trip via HostStateBundle', () => {
    expectTypeOf<HostAdapter['exportState']>().toEqualTypeOf<
      (p: HostProject) => Promise<HostStateBundle>
    >();
    expectTypeOf<HostAdapter['importState']>().toEqualTypeOf<
      (bundle: HostStateBundle) => Promise<HostProject>
    >();
  });
});
