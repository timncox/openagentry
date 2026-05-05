import { describe, it, expect } from 'vitest';
import { isAgentryError, type HostProject, type IsoTimestamp } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import { deploy, rollback } from '../../src/ops/deploy.js';
import { makeMockFetch } from '../helpers/mock-fetch.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

const here = fileURLToPath(new URL('.', import.meta.url));
const sampleSite = resolve(here, '../fixtures/sample-site');

const projectWithSrc = {
  id: 'p',
  hostId: 'p',
  name: 'My Site',
  slug: 'my-site',
  createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
  meta: { srcDir: sampleSite },
} as unknown as HostProject;

const deploymentFixture = {
  id: 'dep-1',
  short_id: 'dep1',
  project_id: 'p',
  project_name: 'my-site',
  environment: 'preview',
  url: 'https://dep-1.my-site.pages.dev',
  created_on: '2026-05-05T11:00:00Z',
  modified_on: '2026-05-05T11:00:00Z',
  latest_stage: { name: 'deploy', status: 'success' },
};

describe('deploy', () => {
  it('runs upload-token -> assets/upsert -> deployments and returns Deployment', async () => {
    const { fetch, calls } = makeMockFetch(
      // 1. POST upload-token
      { body: { success: true, errors: [], messages: [], result: { jwt: 'upload-jwt' } } },
      // 2. POST assets/upsert
      { body: { success: true, errors: [], messages: [], result: { successful_key_count: 2, unsuccessful_keys: [] } } },
      // 3. POST deployments
      { body: { success: true, errors: [], messages: [], result: deploymentFixture } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const dep = await deploy(api, projectWithSrc, 'preview');
    expect(dep.id).toBe('dep-1');
    expect(dep.url).toBe('https://dep-1.my-site.pages.dev');
    expect(dep.env).toBe('preview');
    expect(dep.status).toBe('success');
    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toContain('/upload-token');
    expect(calls[1]?.url).toContain('/pages/assets/upsert');
    expect(calls[1]?.headers['authorization']).toBe('Bearer upload-jwt');
    expect(calls[2]?.url).toContain('/pages/projects/my-site/deployments');
  });

  it('reports asset failures via AgentryError', async () => {
    const { fetch } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: { jwt: 'upload-jwt' } } },
      { body: { success: true, errors: [], messages: [], result: { successful_key_count: 0, unsuccessful_keys: ['abc'] } } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await deploy(api, projectWithSrc, 'preview').catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('deploy');
    expect(err.message).toMatch(/asset/i);
  });

  it('throws AgentryError when meta.srcDir is missing', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    const noSrc: HostProject = {
      id: 'p',
      hostId: 'p',
      name: 'x',
      slug: 'x',
      createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
    };
    const err = await deploy(api, noSrc, 'preview').catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('deploy');
    expect(err.suggestedFix).toMatch(/srcDir/);
  });

  it('passes opts.ref into deployment_trigger metadata', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: { success: true, errors: [], messages: [], result: { jwt: 'upload-jwt' } } },
      { body: { success: true, errors: [], messages: [], result: { successful_key_count: 2, unsuccessful_keys: [] } } },
      { body: { success: true, errors: [], messages: [], result: deploymentFixture } },
    );
    const api = cloudflareApi({ ...baseConfig, fetch });
    await deploy(api, projectWithSrc, 'prod', { ref: 'abc1234' });
    const lastBody = calls[2]?.body ?? '';
    expect(lastBody).toContain('abc1234');
    expect(lastBody).toContain('production');
  });
});

describe('rollback', () => {
  it('POSTs the retry endpoint and returns Deployment', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: deploymentFixture },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const proj: HostProject = {
      id: 'p',
      hostId: 'p',
      name: 'x',
      slug: 'my-site',
      createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
    };
    const dep = await rollback(api, proj, 'dep-1');
    expect(dep.id).toBe('dep-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/pages/projects/my-site/deployments/dep-1/retry');
  });

  it('maps 404 to AgentryError E_CF_NOT_FOUND', async () => {
    const { fetch } = makeMockFetch({ body: 'not found', status: 404, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const proj: HostProject = {
      id: 'p',
      hostId: 'p',
      name: 'x',
      slug: 'my-site',
      createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
    };
    const err = await rollback(api, proj, 'definitely-not-a-real-deployment-id').catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_CF_NOT_FOUND');
    expect(err.phase).toBe('rollback');
  });
});
