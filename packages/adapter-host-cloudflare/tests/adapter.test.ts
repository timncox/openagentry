import { describe, it, expect } from 'vitest';
import { isAgentryError, type ConfirmToken, type Env, type HostProject, type IsoTimestamp } from '@openagentry/core';
import { createCloudflareHostAdapter } from '../src/adapter.js';
import { makeMockFetch } from './helpers/mock-fetch.js';

const baseInput = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

describe('createCloudflareHostAdapter', () => {
  it('returns an adapter with category="host" and id="host-cloudflare"', () => {
    const { fetch } = makeMockFetch();
    const adapter = createCloudflareHostAdapter({ ...baseInput, fetch });
    expect(adapter.category).toBe('host');
    expect(adapter.id).toBe('host-cloudflare');
  });

  it('exposes every HostAdapter method', () => {
    const { fetch } = makeMockFetch();
    const adapter = createCloudflareHostAdapter({ ...baseInput, fetch });
    for (const method of [
      'createProject',
      'destroyProject',
      'deploy',
      'rollback',
      'setEnv',
      'getEnv',
      'attachDomain',
      'detachDomain',
      'logs',
      'exportState',
      'importState',
    ]) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('end-to-end via mocked fetch: createProject -> setEnv -> getEnv round-trips', async () => {
    const cfProject = {
      id: 'cf-1',
      name: 'my-site',
      subdomain: 'my-site.pages.dev',
      domains: [],
      created_on: '2026-01-01T00:00:00Z',
      deployment_configs: { preview: { env_vars: {} }, production: { env_vars: {} } },
    };
    const cfProjectAfterSet = {
      ...cfProject,
      deployment_configs: {
        preview: { env_vars: { K: { type: 'plain_text', value: 'v' } } },
        production: { env_vars: {} },
      },
    };
    const { fetch } = makeMockFetch(
      // createProject
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // setEnv: GET current
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // setEnv: PATCH
      { body: { success: true, errors: [], messages: [], result: cfProjectAfterSet } },
      // getEnv: GET project
      { body: { success: true, errors: [], messages: [], result: cfProjectAfterSet } },
    );
    const adapter = createCloudflareHostAdapter({ ...baseInput, fetch });
    const project = await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    await adapter.setEnv(project, { K: 'v' }, 'preview' as Env);
    const env = await adapter.getEnv(project, 'preview' as Env);
    expect(env).toEqual({ K: 'v' });
  });

  it('end-to-end: rollback with bad id throws AgentryError (matches host conformance contract)', async () => {
    const cfProject = {
      id: 'cf-1',
      name: 'my-site',
      subdomain: 'my-site.pages.dev',
      domains: [],
      created_on: '2026-01-01T00:00:00Z',
      deployment_configs: { preview: { env_vars: {} }, production: { env_vars: {} } },
    };
    const { fetch } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      { body: 'not found', status: 404, headers: { 'content-type': 'text/plain' } },
    );
    const adapter = createCloudflareHostAdapter({ ...baseInput, fetch });
    const project = await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    const err = await adapter.rollback(project, 'definitely-not-a-real-deployment-id').catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_CF_NOT_FOUND');
    expect(err.phase).toBe('rollback');
  });

  it('destroyProject requires non-empty ConfirmToken', async () => {
    const { fetch } = makeMockFetch();
    const adapter = createCloudflareHostAdapter({ ...baseInput, fetch });
    const proj: HostProject = {
      id: 'p',
      hostId: 'p',
      name: 'x',
      slug: 'my-site',
      createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
    };
    const err = await adapter.destroyProject(proj, '' as ConfirmToken).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('destroyProject');
  });
});
