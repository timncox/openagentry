import { describe, it, expect } from 'vitest';
import type { HostProject, HostStateBundle, IsoTimestamp } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import { exportState, importState } from '../../src/ops/state.js';
import { makeMockFetch } from '../helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

const proj: HostProject = {
  id: 'p',
  hostId: 'cf-id-1',
  name: 'My Site',
  slug: 'my-site',
  createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
};

const cfProject = {
  id: 'cf-id-1',
  name: 'my-site',
  subdomain: 'my-site.pages.dev',
  domains: ['my-site.pages.dev', 'example.com'],
  created_on: '2026-01-01T00:00:00Z',
  deployment_configs: {
    preview: { env_vars: { K: { type: 'plain_text', value: 'p1' } } },
    production: { env_vars: { K: { type: 'plain_text', value: 'p2' } } },
  },
};

describe('exportState', () => {
  it('reads project + envs + domains into a HostStateBundle', async () => {
    const { fetch } = makeMockFetch(
      // GET project (used by getEnv preview)
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // GET project (used by getEnv prod)
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // GET project (used by exportState for domains)
      { body: { success: true, errors: [], messages: [], result: cfProject } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const bundle = await exportState(api, proj);
    expect(bundle.version).toBe(1);
    expect(bundle.hostProject.hostId).toBe('cf-id-1');
    expect(bundle.env.preview).toEqual({ K: 'p1' });
    expect(bundle.env.prod).toEqual({ K: 'p2' });
    expect(bundle.env.dev).toEqual({});
    expect(bundle.domains.sort()).toEqual(['example.com', 'my-site.pages.dev']);
  });
});

describe('importState', () => {
  it('finds existing project by slug and returns it (idempotent)', async () => {
    const bundle: HostStateBundle = {
      version: 1,
      hostProject: { ...proj },
      env: { preview: {}, prod: {}, dev: {} },
      domains: [],
    };
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: cfProject },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await importState(api, bundle);
    expect(result.hostId).toBe('cf-id-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toContain('/pages/projects/my-site');
  });

  it('creates the project + re-applies env + domains when slug not found', async () => {
    const bundle: HostStateBundle = {
      version: 1,
      hostProject: { ...proj },
      env: { preview: { K: 'p1' }, prod: {}, dev: {} },
      domains: ['example.com'],
    };
    const { fetch } = makeMockFetch(
      // 1. getProjectByName -> 404
      { body: 'not found', status: 404, headers: { 'content-type': 'text/plain' } },
      // 2. createProject -> success
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // 3. setEnv preview: GET current
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // 4. setEnv preview: PATCH
      { body: { success: true, errors: [], messages: [], result: cfProject } },
      // 5. attachDomain -> success
      { body: { success: true, errors: [], messages: [], result: { id: 'd', name: 'example.com', status: 'pending' } } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await importState(api, bundle);
    expect(result.hostId).toBe('cf-id-1');
    expect(result.slug).toBe('my-site');
  });
});
