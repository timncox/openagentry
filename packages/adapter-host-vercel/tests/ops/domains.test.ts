import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { VercelHostConfig } from '../../src/config.js';
import type { HostProject } from '@openagentry/core';
import {
  attachDomain,
  detachDomain,
  mapVerificationToDnsRecords,
} from '../../src/ops/domains.js';

const BASE = 'https://api.vercel.com';

const cfg: VercelHostConfig = {
  token: 'tok_test',
  endpoint: BASE,
};

const project: HostProject = {
  id: 'prj_abc',
  name: 'my-app',
  slug: 'my-app',
  hostId: 'prj_abc',
  createdAt: '2026-01-01T00:00:00.000Z' as import('@openagentry/core').IsoTimestamp,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// mapVerificationToDnsRecords (unit — no HTTP)
// ---------------------------------------------------------------------------

describe('mapVerificationToDnsRecords', () => {
  it('filters non-DNS-record verification types', () => {
    const records = mapVerificationToDnsRecords([
      { type: 'TXT', domain: '_vercel.example.com', value: 'vc-domain-verify=abc' },
      { type: 'TXT_VERIFY', domain: '_challenge.example.com', value: 'random' },
      { type: 'CNAME', domain: 'www.example.com', value: 'cname.vercel-dns.com' },
      { type: 'UNKNOWN_TYPE', domain: 'foo.example.com', value: 'bar' },
    ]);
    expect(records).toHaveLength(2);
    expect(records![0]).toMatchObject({ type: 'TXT', name: '_vercel.example.com' });
    expect(records![1]).toMatchObject({ type: 'CNAME', name: 'www.example.com' });
  });

  it('returns empty array when all types are unrecognised', () => {
    const records = mapVerificationToDnsRecords([
      { type: 'NS', domain: 'example.com', value: 'ns1.vercel.com' },
    ]);
    expect(records).toHaveLength(0);
  });

  it('normalises type to uppercase', () => {
    const records = mapVerificationToDnsRecords([
      { type: 'a', domain: '@', value: '76.76.21.21' },
      { type: 'aaaa', domain: '@', value: '2606:4700::' },
      { type: 'mx', domain: '@', value: 'mail.example.com' },
    ]);
    expect(records!.map((r) => r.type)).toEqual(['A', 'AAAA', 'MX']);
  });

  it('handles already-uppercase types', () => {
    const records = mapVerificationToDnsRecords([
      { type: 'A', domain: '@', value: '76.76.21.21' },
      { type: 'TXT', domain: '_v', value: 'some-val' },
    ]);
    expect(records!.map((r) => r.type)).toEqual(['A', 'TXT']);
  });
});

// ---------------------------------------------------------------------------
// attachDomain
// ---------------------------------------------------------------------------

describe('attachDomain', () => {
  it('returns pending with pendingRecords for unverified domain', async () => {
    server.use(
      http.post(`${BASE}/v10/projects/${project.slug}/domains`, () =>
        HttpResponse.json({
          name: 'example.com',
          verified: false,
          verification: [
            {
              type: 'TXT',
              domain: '_vercel.example.com',
              value: 'vc-domain-verify=abc123',
              reason: '',
            },
          ],
        }),
      ),
    );

    const result = await attachDomain(cfg, project, 'example.com');

    expect(result.domain).toBe('example.com');
    expect(result.status).toBe('pending');
    expect(result.pendingRecords).toHaveLength(1);
    expect(result.pendingRecords![0]).toMatchObject({
      type: 'TXT',
      name: '_vercel.example.com',
      value: 'vc-domain-verify=abc123',
    });
  });

  it('returns active for a verified domain', async () => {
    server.use(
      http.post(`${BASE}/v10/projects/${project.slug}/domains`, () =>
        HttpResponse.json({
          name: 'verified.example.com',
          verified: true,
          verification: [],
        }),
      ),
    );

    const result = await attachDomain(cfg, project, 'verified.example.com');

    expect(result.domain).toBe('verified.example.com');
    expect(result.status).toBe('active');
    // pendingRecords is omitted when empty (active domain)
  });

  it('returns failed when first verification reason contains "fail"', async () => {
    server.use(
      http.post(`${BASE}/v10/projects/${project.slug}/domains`, () =>
        HttpResponse.json({
          name: 'fail.example.com',
          verified: false,
          verification: [
            {
              type: 'TXT',
              domain: '_vercel.fail.example.com',
              value: 'vc-domain-verify=xyz',
              reason: 'verification_failed',
            },
          ],
        }),
      ),
    );

    const result = await attachDomain(cfg, project, 'fail.example.com');

    expect(result.status).toBe('failed');
  });

  it('throws E_VERCEL_INVALID for 409 already-attached (mapped via upstream)', async () => {
    server.use(
      http.post(`${BASE}/v10/projects/${project.slug}/domains`, () =>
        HttpResponse.json(
          { error: { code: 'domain_already_in_use', message: 'Domain already in use.' } },
          { status: 409 },
        ),
      ),
    );

    await expect(attachDomain(cfg, project, 'duplicate.example.com')).rejects.toMatchObject({
      code: 'E_VERCEL_UPSTREAM',
    });
  });
});

// ---------------------------------------------------------------------------
// detachDomain
// ---------------------------------------------------------------------------

describe('detachDomain', () => {
  it('resolves on 204 No Content', async () => {
    server.use(
      http.delete(
        `${BASE}/v9/projects/${project.slug}/domains/example.com`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(detachDomain(cfg, project, 'example.com')).resolves.toBeUndefined();
  });

  it('throws E_VERCEL_NOT_FOUND on 404', async () => {
    server.use(
      http.delete(
        `${BASE}/v9/projects/${project.slug}/domains/gone.example.com`,
        () =>
          HttpResponse.json(
            { error: { code: 'not_found', message: 'Domain not found.' } },
            { status: 404 },
          ),
      ),
    );

    await expect(detachDomain(cfg, project, 'gone.example.com')).rejects.toMatchObject({
      code: 'E_VERCEL_NOT_FOUND',
    });
  });

  it('URL-encodes the domain in the DELETE path', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.delete(`${BASE}/v9/projects/${project.slug}/domains/www.example.com`, ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await detachDomain(cfg, project, 'www.example.com');
    expect(capturedUrl).toContain('/v9/projects/my-app/domains/www.example.com');
  });
});
