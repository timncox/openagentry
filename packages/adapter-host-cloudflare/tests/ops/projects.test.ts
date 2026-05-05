import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import {
  createProject,
  destroyProject,
  getProjectByName,
} from '../../src/ops/projects.js';
import { makeMockFetch } from '../helpers/mock-fetch.js';

const baseConfig = {
  apiToken: 't',
  accountId: '0123456789abcdef0123456789abcdef',
  apiBase: 'https://api.cloudflare.com/client/v4',
} as const;

const projectFixture = {
  id: 'pages-id-1',
  name: 'my-site',
  subdomain: 'my-site.pages.dev',
  domains: ['my-site.pages.dev'],
  created_on: '2026-05-05T10:00:00Z',
  deployment_configs: { preview: {}, production: {} },
};

describe('createProject', () => {
  it('POSTs to /pages/projects and returns a HostProject with hostId set', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: projectFixture },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const project = await createProject(api, { name: 'My Site', slug: 'my-site' });
    expect(project.hostId).toBe('pages-id-1');
    expect(project.slug).toBe('my-site');
    expect(project.name).toBe('My Site');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/pages/projects');
    const body = JSON.parse(calls[0]?.body ?? '{}') as { name: string };
    expect(body.name).toBe('my-site');
  });

  it('persists meta.srcDir when provided', async () => {
    const { fetch } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: projectFixture },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const project = await createProject(api, {
      name: 'My Site',
      slug: 'my-site',
      meta: { srcDir: '/abs/path/dist' },
    });
    const meta = (project as { meta?: Record<string, unknown> }).meta;
    expect(meta?.['srcDir']).toBe('/abs/path/dist');
  });

  it('is idempotent: when Cloudflare returns "already exists", looks up + returns existing project', async () => {
    const dupErr = {
      body: {
        success: false,
        errors: [{ code: 8000007, message: 'project name already exists' }],
        messages: [],
        result: null,
      },
    };
    const lookup = {
      body: { success: true, errors: [], messages: [], result: projectFixture },
    };
    const { fetch, calls } = makeMockFetch(dupErr, lookup);
    const api = cloudflareApi({ ...baseConfig, fetch });
    const project = await createProject(api, { name: 'My Site', slug: 'my-site' });
    expect(project.hostId).toBe('pages-id-1');
    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/pages/projects/my-site');
  });

  it('rethrows non-duplicate Cloudflare errors as AgentryError', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: false,
        errors: [{ code: 12345, message: 'unrelated failure' }],
        messages: [],
        result: null,
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await createProject(api, { name: 'x', slug: 'x' }).catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_CF_PAGES_API');
    expect(err.phase).toBe('createProject');
  });

  it('throws when dup-project GET returns null (ghost project)', async () => {
    const dupErr = {
      body: {
        success: false,
        errors: [{ code: 8000007, message: 'project name already exists' }],
        messages: [],
        result: null,
      },
    };
    const notFound = { body: 'not found', status: 404, headers: { 'content-type': 'text/plain' } };
    const { fetch } = makeMockFetch(dupErr, notFound);
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await createProject(api, { name: 'My Site', slug: 'my-site' }).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_CF_PAGES_API');
    expect(err.phase).toBe('createProject');
    expect(err.message).toContain('follow-up GET returned 404');
  });
});

describe('destroyProject', () => {
  it('DELETEs /pages/projects/{name} and resolves to undefined', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: { id: 'pages-id-1' } },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out = await destroyProject(
      api,
      { id: 'p', name: 'x', slug: 'my-site', createdAt: '2026-01-01T00:00:00Z' as never, hostId: 'pages-id-1' },
      'CONFIRM-DELETE' as never,
    );
    expect(out).toBeUndefined();
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toContain('/pages/projects/my-site');
  });

  it('throws AgentryError when ConfirmToken is empty', async () => {
    const { fetch } = makeMockFetch();
    const api = cloudflareApi({ ...baseConfig, fetch });
    await expect(
      destroyProject(
        api,
        { id: 'p', name: 'x', slug: 'my-site', createdAt: '2026-01-01T00:00:00Z' as never, hostId: 'pages-id-1' },
        '' as never,
      ),
    ).rejects.toMatchObject({ code: 'E_CF_HTTP', phase: 'destroyProject' });
  });
});

describe('getProjectByName', () => {
  it('GETs /pages/projects/{name} and normalizes to HostProject', async () => {
    const { fetch } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: projectFixture },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const project = await getProjectByName(api, 'my-site', 'createProject');
    expect(project?.hostId).toBe('pages-id-1');
    expect(project?.slug).toBe('my-site');
  });

  it('returns null on 404', async () => {
    const { fetch } = makeMockFetch({ body: 'not found', status: 404, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const project = await getProjectByName(api, 'missing', 'createProject');
    expect(project).toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    const { fetch } = makeMockFetch({ body: 'internal error', status: 500, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await getProjectByName(api, 'x', 'createProject').catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_CF_HTTP');
  });
});
