import { describe, it, expect } from 'vitest';
import { isAgentryError, type Env, type HostProject, type IsoTimestamp } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import { setEnv, getEnv, mapEnvToCfEnv } from '../../src/ops/env.js';
import { makeMockFetch } from '../helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

const proj: HostProject = {
  id: 'p',
  hostId: 'p',
  name: 'My Site',
  slug: 'my-site',
  createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
};

const projectWithEnv = (env: Record<string, { type: 'plain_text'; value: string }>) => ({
  id: 'p',
  name: 'my-site',
  subdomain: 'my-site.pages.dev',
  domains: [],
  created_on: '2026-01-01T00:00:00Z',
  deployment_configs: {
    preview: { env_vars: env },
    production: { env_vars: {} },
  },
});

describe('mapEnvToCfEnv', () => {
  it('maps preview -> preview', () => {
    expect(mapEnvToCfEnv('preview' as Env)).toBe('preview');
  });
  it('maps prod -> production', () => {
    expect(mapEnvToCfEnv('prod' as Env)).toBe('production');
  });
  it('throws AgentryError on dev', () => {
    const err = (() => { try { mapEnvToCfEnv('dev' as Env); return null; } catch (e) { return e; } })();
    expect(err).not.toBeNull();
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('unreachable');
    expect(err.message).toMatch(/dev/);
    expect(err.code).toBe('E_CF_SCHEMA');
  });
});

describe('setEnv', () => {
  it('PATCHes project with merged env_vars (preview)', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: projectWithEnv({ EXISTING: { type: 'plain_text', value: 'old' } }) } },
      { body: { success: true, errors: [], messages: [], result: projectWithEnv({ EXISTING: { type: 'plain_text', value: 'old' }, NEW_KEY: { type: 'plain_text', value: 'v1' } }) } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    await setEnv(api, proj, { NEW_KEY: 'v1' }, 'preview' as Env);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.method).toBe('PATCH');
    expect(calls[1]?.url).toContain('/pages/projects/my-site');
    const body = JSON.parse(calls[1]?.body ?? '{}') as {
      deployment_configs?: { preview?: { env_vars?: Record<string, { type: string; value: string }> } };
    };
    expect(body.deployment_configs?.preview?.env_vars?.['NEW_KEY']).toEqual({ type: 'plain_text', value: 'v1' });
    expect(body.deployment_configs?.preview?.env_vars?.['EXISTING']).toEqual({ type: 'plain_text', value: 'old' });
  });

  it('is idempotent: calling twice with same input ends in same final state', async () => {
    const projAfterFirst = projectWithEnv({ KEY: { type: 'plain_text', value: 'v1' } });
    const { fetch } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: projectWithEnv({}) } },
      { body: { success: true, errors: [], messages: [], result: projAfterFirst } },
      { body: { success: true, errors: [], messages: [], result: projAfterFirst } },
      { body: { success: true, errors: [], messages: [], result: projAfterFirst } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(setEnv(api, proj, { KEY: 'v1' }, 'preview' as Env)).resolves.toBeUndefined();
    await expect(setEnv(api, proj, { KEY: 'v1' }, 'preview' as Env)).resolves.toBeUndefined();
  });

  it('routes prod to production', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: projectWithEnv({}) } },
      { body: { success: true, errors: [], messages: [], result: projectWithEnv({}) } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    await setEnv(api, proj, { KEY: 'v' }, 'prod' as Env);
    const body = JSON.parse(calls[1]?.body ?? '{}') as {
      deployment_configs?: { production?: { env_vars?: Record<string, unknown> } };
    };
    expect(body.deployment_configs?.production?.env_vars?.['KEY']).toBeDefined();
  });

  it('rejects dev environment with AgentryError', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await setEnv(api, proj, { K: 'v' }, 'dev' as Env).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('setEnv');
    expect(err.code).toBe('E_CF_SCHEMA');
    expect(err.message).toMatch(/dev/);
  });
});

describe('getEnv', () => {
  it('returns the plain_text values stored on the project', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: true,
        errors: [],
        messages: [],
        result: projectWithEnv({ K1: { type: 'plain_text', value: 'v1' }, K2: { type: 'plain_text', value: 'v2' } }),
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const env = await getEnv(api, proj, 'preview' as Env);
    expect(env).toEqual({ K1: 'v1', K2: 'v2' });
  });

  it('omits secret_text entries (cannot round-trip)', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: true,
        errors: [],
        messages: [],
        result: {
          id: 'p',
          name: 'my-site',
          subdomain: 'my-site.pages.dev',
          domains: [],
          created_on: '2026-01-01T00:00:00Z',
          deployment_configs: {
            preview: { env_vars: { K1: { type: 'plain_text', value: 'v1' }, SECRET: { type: 'secret_text', value: '***' } } },
            production: { env_vars: {} },
          },
        },
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const env = await getEnv(api, proj, 'preview' as Env);
    expect(env).toEqual({ K1: 'v1' });
  });

  it('returns {} when no env_vars are set', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: true,
        errors: [],
        messages: [],
        result: {
          id: 'p',
          name: 'my-site',
          subdomain: 'my-site.pages.dev',
          domains: [],
          created_on: '2026-01-01T00:00:00Z',
          deployment_configs: { preview: {}, production: {} },
        },
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const env = await getEnv(api, proj, 'preview' as Env);
    expect(env).toEqual({});
  });

  it('rejects dev environment with AgentryError (phase: getEnv)', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await getEnv(api, proj, 'dev' as Env).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('getEnv');
    expect(err.code).toBe('E_CF_SCHEMA');
    expect(err.message).toMatch(/dev/);
  });
});
