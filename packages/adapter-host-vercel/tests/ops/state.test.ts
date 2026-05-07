import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { VercelHostConfig } from '../../src/config.js';
import type { HostProject, HostStateBundle, IsoTimestamp } from '@openagentry/core';
import { exportState, importState } from '../../src/ops/state.js';

const BASE = 'https://api.vercel.com';

const cfg: VercelHostConfig = {
  token: 'tok_test',
  endpoint: BASE,
};

const project: HostProject = {
  id: 'prj_state',
  name: 'state-app',
  slug: 'state-app',
  hostId: 'prj_state',
  createdAt: '2026-01-01T00:00:00.000Z' as IsoTimestamp,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers for common mock handlers
// ---------------------------------------------------------------------------

/** Mock GET /v9/projects/{slug}/domains returning a domain list. */
function mockGetDomains(slug: string, domains: string[]) {
  return http.get(`${BASE}/v9/projects/${slug}/domains`, () =>
    HttpResponse.json({
      domains: domains.map((name) => ({ name, verified: true, verification: [] })),
    }),
  );
}

// ---------------------------------------------------------------------------
// exportState
// ---------------------------------------------------------------------------

describe('exportState', () => {
  it('collects all 3 envs and the domain list', async () => {
    server.use(
      // getEnv is called 3 times — all hit the same path.
      // Use a stateful handler to return different data per call.
      (() => {
        let callCount = 0;
        const envsByCall: Record<string, { target: string; vars: Record<string, string> }> = {
          '0': { target: 'preview', vars: { PREVIEW_KEY: 'pval' } },
          '1': { target: 'production', vars: { PROD_KEY: 'prodval' } },
          '2': { target: 'development', vars: { DEV_KEY: 'devval' } },
        };
        return http.get(`${BASE}/v9/projects/${project.slug}/env`, () => {
          const idx = String(callCount++);
          const entry = envsByCall[idx];
          if (entry === undefined) return HttpResponse.json({ envs: [] });
          const entries = Object.entries(entry.vars).map(([key, value]) => ({
            id: `env-${idx}-${key}`,
            key,
            value,
            target: [entry.target],
            type: 'plain',
          }));
          return HttpResponse.json({ envs: entries });
        });
      })(),
      mockGetDomains(project.slug, ['example.com', 'www.example.com']),
    );

    const bundle = await exportState(cfg, project);

    expect(bundle.version).toBe(1);
    expect(bundle.hostProject).toEqual(project);
    expect(bundle.env.preview).toMatchObject({ PREVIEW_KEY: 'pval' });
    expect(bundle.env.prod).toMatchObject({ PROD_KEY: 'prodval' });
    expect(bundle.env.dev).toMatchObject({ DEV_KEY: 'devval' });
    expect(bundle.domains).toEqual(['example.com', 'www.example.com']);
  });

  it('returns empty env and empty domains when nothing is set', async () => {
    server.use(
      http.get(`${BASE}/v9/projects/${project.slug}/env`, () =>
        HttpResponse.json({ envs: [] }),
      ),
      http.get(`${BASE}/v9/projects/${project.slug}/domains`, () =>
        HttpResponse.json({ domains: [] }),
      ),
    );

    const bundle = await exportState(cfg, project);

    expect(bundle.env.preview).toEqual({});
    expect(bundle.env.prod).toEqual({});
    expect(bundle.env.dev).toEqual({});
    expect(bundle.domains).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// importState — happy path
// ---------------------------------------------------------------------------

describe('importState — happy path', () => {
  it('calls createProject + 3 setEnv + N attachDomain', async () => {
    const calls: string[] = [];

    server.use(
      // createProject → POST /v11/projects
      http.post(`${BASE}/v11/projects`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        calls.push(`createProject:${body.name}`);
        return HttpResponse.json({
          id: 'prj_new',
          name: body.name,
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      }),

      // setEnv → GET /v9/projects/{slug}/env?decrypt=true (checks existing vars)
      http.get(`${BASE}/v9/projects/state-app/env`, () =>
        HttpResponse.json({ envs: [] }),
      ),

      // setEnv → POST /v10/projects/{slug}/env (creates individual vars)
      http.post(`${BASE}/v10/projects/state-app/env`, async ({ request }) => {
        const body = (await request.json()) as { key: string; target: string[] };
        calls.push(`setEnv:${body.target[0] ?? ''}:${body.key}`);
        return HttpResponse.json({
          id: `env-${body.key}`,
          key: body.key,
          value: 'x',
          target: body.target,
          type: 'plain',
        });
      }),

      // attachDomain → POST /v10/projects/{slug}/domains
      http.post(`${BASE}/v10/projects/state-app/domains`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        calls.push(`attachDomain:${body.name}`);
        return HttpResponse.json({ name: body.name, verified: false, verification: [] });
      }),
    );

    const bundle: HostStateBundle = {
      version: 1,
      hostProject: project,
      env: {
        preview: { PREVIEW_K: 'pv' },
        prod: { PROD_K: 'prd' },
        dev: { DEV_K: 'dv' },
      },
      domains: ['alpha.example.com', 'beta.example.com'],
    };

    const result = await importState(cfg, bundle);

    expect(result.name).toBe('state-app');
    expect(calls).toContain('createProject:state-app');
    // All 3 env vars should have been set.
    expect(calls.some((c) => c.includes('setEnv') && c.includes('PREVIEW_K'))).toBe(true);
    expect(calls.some((c) => c.includes('setEnv') && c.includes('PROD_K'))).toBe(true);
    expect(calls.some((c) => c.includes('setEnv') && c.includes('DEV_K'))).toBe(true);
    // Both domains should have been attached.
    expect(calls).toContain('attachDomain:alpha.example.com');
    expect(calls).toContain('attachDomain:beta.example.com');
  });
});

// ---------------------------------------------------------------------------
// importState — validation errors
// ---------------------------------------------------------------------------

describe('importState — validation', () => {
  it('throws E_VERCEL_BAD_STATE for wrong version', async () => {
    const badBundle = {
      version: 99,
      hostProject: { id: 'x', name: 'x', slug: 'x', hostId: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      env: { preview: {}, prod: {}, dev: {} },
      domains: [],
    };

    await expect(
      importState(cfg, badBundle as unknown as HostStateBundle),
    ).rejects.toMatchObject({
      code: 'E_VERCEL_BAD_STATE',
    });
  });

  it('throws E_VERCEL_BAD_STATE when hostProject.slug is missing', async () => {
    const badBundle = {
      version: 1,
      hostProject: { id: 'x', name: 'x', hostId: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      env: { preview: {}, prod: {}, dev: {} },
      domains: [],
    };

    await expect(
      importState(cfg, badBundle as unknown as HostStateBundle),
    ).rejects.toMatchObject({
      code: 'E_VERCEL_BAD_STATE',
    });
  });

  it('throws E_VERCEL_BAD_STATE when domains field is not an array', async () => {
    const badBundle = {
      version: 1,
      hostProject: { id: 'x', name: 'x', slug: 'x', hostId: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      env: { preview: {}, prod: {}, dev: {} },
      domains: 'not-an-array',
    };

    await expect(
      importState(cfg, badBundle as unknown as HostStateBundle),
    ).rejects.toMatchObject({
      code: 'E_VERCEL_BAD_STATE',
    });
  });

  it('throws E_VERCEL_BAD_STATE when env field is null', async () => {
    const badBundle = {
      version: 1,
      hostProject: { id: 'x', name: 'x', slug: 'x', hostId: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      env: null,
      domains: [],
    };

    await expect(
      importState(cfg, badBundle as unknown as HostStateBundle),
    ).rejects.toMatchObject({
      code: 'E_VERCEL_BAD_STATE',
    });
  });
});

// ---------------------------------------------------------------------------
// importState — partial domain failure
// ---------------------------------------------------------------------------

describe('importState — partial domain failure', () => {
  it('swallows individual domain attach failures and still returns the project', async () => {
    const attachedDomains: string[] = [];

    server.use(
      http.post(`${BASE}/v11/projects`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({
          id: 'prj_partial',
          name: body.name,
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      }),

      // setEnv GET — no existing vars (env is empty, no vars to set)
      http.get(`${BASE}/v9/projects/state-app/env`, () =>
        HttpResponse.json({ envs: [] }),
      ),

      // attachDomain — succeed for 'good.example.com', fail for 'bad.example.com'
      http.post(`${BASE}/v10/projects/state-app/domains`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        if (body.name === 'bad.example.com') {
          return HttpResponse.json(
            { error: { code: 'invalid_domain', message: 'Domain cannot be attached.' } },
            { status: 422 },
          );
        }
        attachedDomains.push(body.name);
        return HttpResponse.json({ name: body.name, verified: false, verification: [] });
      }),
    );

    const bundle: HostStateBundle = {
      version: 1,
      hostProject: project,
      env: { preview: {}, prod: {}, dev: {} },
      domains: ['good.example.com', 'bad.example.com', 'also-good.example.com'],
    };

    // Should NOT throw — domain failures are best-effort.
    const result = await importState(cfg, bundle);

    expect(result.name).toBe('state-app');
    // good and also-good were attached; bad was swallowed.
    expect(attachedDomains).toContain('good.example.com');
    expect(attachedDomains).toContain('also-good.example.com');
    expect(attachedDomains).not.toContain('bad.example.com');
  });
});
