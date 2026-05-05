import { describe, it, expect } from 'vitest';
import { isAgentryError, type HostProject, type IsoTimestamp } from '@openagentry/core';
import { cloudflareApi } from '../../src/client.js';
import { attachDomain, detachDomain } from '../../src/ops/domains.js';
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

const domainFixture = {
  id: 'd-1',
  name: 'example.com',
  status: 'pending',
  validation_data: { status: 'pending', method: 'http' },
};

describe('attachDomain', () => {
  it('POSTs /domains with the name and returns DomainAttachment', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { success: true, errors: [], messages: [], result: domainFixture },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await attachDomain(api, proj, 'example.com');
    expect(result.domain).toBe('example.com');
    expect(result.status).toBe('pending');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/pages/projects/my-site/domains');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ name: 'example.com' });
  });

  it('maps active status correctly', async () => {
    const { fetch } = makeMockFetch({
      body: {
        success: true,
        errors: [],
        messages: [],
        result: { ...domainFixture, status: 'active' },
      },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await attachDomain(api, proj, 'example.com');
    expect(result.status).toBe('active');
  });

  it('is idempotent: re-attaching an existing domain returns active without error', async () => {
    const dupBody = {
      success: false,
      errors: [{ code: 8000022, message: 'domain already exists' }],
      messages: [],
      result: null,
    };
    const lookupBody = {
      success: true,
      errors: [],
      messages: [],
      result: { ...domainFixture, status: 'active' },
    };
    const { fetch, calls } = makeMockFetch({ body: dupBody }, { body: lookupBody });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const result = await attachDomain(api, proj, 'example.com');
    expect(result.status).toBe('active');
    expect(calls).toHaveLength(2);
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/pages/projects/my-site/domains/example.com');
  });

  it('rethrows non-duplicate errors', async () => {
    const { fetch } = makeMockFetch({
      body: { success: false, errors: [{ code: 12345, message: 'unrelated' }], messages: [], result: null },
    });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const err = await attachDomain(api, proj, 'example.com').catch((e: unknown) => e);
    expect(isAgentryError(err)).toBe(true);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('attachDomain');
  });
});

describe('detachDomain', () => {
  it('DELETEs /domains/{name} and resolves to undefined', async () => {
    const { fetch, calls } = makeMockFetch({ body: '', status: 204, headers: { 'content-type': 'text/plain' } });
    const api = cloudflareApi({ ...baseConfig, fetch });
    const out = await detachDomain(api, proj, 'example.com');
    expect(out).toBeUndefined();
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toContain('/pages/projects/my-site/domains/example.com');
  });
});
