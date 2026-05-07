import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { deploy, rollback, mapReadyState, mapDeployment } from '../../src/ops/deploy.js';
import type { VercelHostConfig } from '../../src/config.js';
import { VERCEL_ERROR_CODES } from '../../src/errors.js';
import type { HostProject, IsoTimestamp } from '@openagentry/core';

const cfg: VercelHostConfig = {
  token: 'test_token_abc',
  endpoint: 'https://api.vercel.com',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stubProject: HostProject = {
  id: 'prj_abc123',
  hostId: 'prj_abc123',
  name: 'My App',
  slug: 'my-app',
  createdAt: '2026-05-07T10:00:00.000Z' as IsoTimestamp,
};

function projectWithLink(overrides: Partial<{ repoId: number; productionBranch: string }> = {}) {
  return {
    id: 'prj_abc123',
    name: 'my-app',
    link: {
      repoId: overrides.repoId ?? 12345,
      productionBranch: overrides.productionBranch ?? 'main',
    },
  };
}

function deploymentJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'dpl_xyz789',
    uid: 'dpl_xyz789',
    url: 'my-app-abc123.vercel.app',
    readyState: 'BUILDING',
    target: 'preview',
    createdAt: '2026-05-07T10:05:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deploy — happy path (preview)
// ---------------------------------------------------------------------------

describe('deploy — preview target', () => {
  it('returns a Deployment with env=preview for preview target', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink()),
      ),
      http.post('https://api.vercel.com/v13/deployments', () =>
        HttpResponse.json(deploymentJson({ readyState: 'BUILDING', target: 'preview' })),
      ),
    );
    const result = await deploy(cfg, stubProject, 'preview');
    expect(result.id).toBe('dpl_xyz789');
    expect(result.env).toBe('preview');
    expect(result.status).toBe('building');
    expect(result.url).toBe('my-app-abc123.vercel.app');
    expect(result.meta?.['provider']).toBe('vercel');
  });

  it('sends target=preview in request body for preview env', async () => {
    let capturedBody: unknown;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink()),
      ),
      http.post('https://api.vercel.com/v13/deployments', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(deploymentJson());
      }),
    );
    await deploy(cfg, stubProject, 'preview');
    expect((capturedBody as Record<string, unknown>)['target']).toBe('preview');
  });
});

// ---------------------------------------------------------------------------
// deploy — prod target
// ---------------------------------------------------------------------------

describe('deploy — prod target', () => {
  it('returns a Deployment with env=prod for production target', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink()),
      ),
      http.post('https://api.vercel.com/v13/deployments', () =>
        HttpResponse.json(deploymentJson({ readyState: 'READY', target: 'production' })),
      ),
    );
    const result = await deploy(cfg, stubProject, 'prod');
    expect(result.env).toBe('prod');
    expect(result.status).toBe('success');
  });

  it('sends target=production in request body for prod env', async () => {
    let capturedBody: unknown;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink()),
      ),
      http.post('https://api.vercel.com/v13/deployments', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(deploymentJson({ target: 'production' }));
      }),
    );
    await deploy(cfg, stubProject, 'prod');
    expect((capturedBody as Record<string, unknown>)['target']).toBe('production');
  });
});

// ---------------------------------------------------------------------------
// deploy — opts.ref defaulting
// ---------------------------------------------------------------------------

describe('deploy — ref defaulting', () => {
  it('uses opts.ref when provided', async () => {
    let capturedBody: unknown;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink({ productionBranch: 'main' })),
      ),
      http.post('https://api.vercel.com/v13/deployments', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(deploymentJson());
      }),
    );
    await deploy(cfg, stubProject, 'preview', { ref: 'feature/my-branch' });
    const body = capturedBody as Record<string, unknown>;
    const gs = body['gitSource'] as Record<string, unknown>;
    expect(gs['ref']).toBe('feature/my-branch');
  });

  it('uses productionBranch from project link when opts.ref is omitted', async () => {
    let capturedBody: unknown;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(projectWithLink({ productionBranch: 'release' })),
      ),
      http.post('https://api.vercel.com/v13/deployments', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(deploymentJson());
      }),
    );
    await deploy(cfg, stubProject, 'preview');
    const body = capturedBody as Record<string, unknown>;
    const gs = body['gitSource'] as Record<string, unknown>;
    expect(gs['ref']).toBe('release');
  });

  it('falls back to "main" when productionBranch is absent from link', async () => {
    let capturedBody: unknown;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json({
          id: 'prj_abc123',
          name: 'my-app',
          link: { repoId: 12345 }, // no productionBranch
        }),
      ),
      http.post('https://api.vercel.com/v13/deployments', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(deploymentJson());
      }),
    );
    await deploy(cfg, stubProject, 'preview');
    const body = capturedBody as Record<string, unknown>;
    const gs = body['gitSource'] as Record<string, unknown>;
    expect(gs['ref']).toBe('main');
  });
});

// ---------------------------------------------------------------------------
// deploy — no git link → NO_GIT_LINK
// ---------------------------------------------------------------------------

describe('deploy — no git link', () => {
  it('throws E_VERCEL_NO_GIT_LINK when project.link is null', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json({ id: 'prj_abc123', name: 'my-app', link: null }),
      ),
    );
    await expect(deploy(cfg, stubProject, 'preview')).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.NO_GIT_LINK,
      phase: 'deploy',
    });
  });

  it('throws E_VERCEL_NO_GIT_LINK when project.link is absent', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json({ id: 'prj_abc123', name: 'my-app' }),
      ),
    );
    await expect(deploy(cfg, stubProject, 'preview')).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.NO_GIT_LINK,
    });
  });
});

// ---------------------------------------------------------------------------
// deploy — 401 → AUTH
// ---------------------------------------------------------------------------

describe('deploy — 401 → AUTH', () => {
  it('throws E_VERCEL_AUTH when the project GET returns 401', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(
          { error: { code: 'forbidden', message: 'Not authenticated.' } },
          { status: 401 },
        ),
      ),
    );
    await expect(deploy(cfg, stubProject, 'preview')).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.AUTH,
      phase: 'deploy',
    });
  });
});

// ---------------------------------------------------------------------------
// rollback — happy path
// ---------------------------------------------------------------------------

describe('rollback — happy path', () => {
  it('returns a Deployment after promoting the given deployment', async () => {
    server.use(
      http.post(
        'https://api.vercel.com/v10/projects/my-app/promote/dpl_oldabc',
        () => HttpResponse.json(deploymentJson({ id: 'dpl_oldabc', readyState: 'READY', target: 'production' })),
      ),
    );
    const result = await rollback(cfg, stubProject, 'dpl_oldabc');
    expect(result.id).toBe('dpl_oldabc');
    expect(result.status).toBe('success');
    expect(result.env).toBe('prod');
  });

  it('uses p.slug and deploymentId in the promote URL', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.post(
        'https://api.vercel.com/v10/projects/my-app/promote/dpl_specific',
        ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(deploymentJson({ id: 'dpl_specific' }));
        },
      ),
    );
    await rollback(cfg, stubProject, 'dpl_specific');
    expect(capturedUrl).toContain('/v10/projects/my-app/promote/dpl_specific');
  });
});

// ---------------------------------------------------------------------------
// rollback — 404 → NOT_FOUND
// ---------------------------------------------------------------------------

describe('rollback — 404 → NOT_FOUND', () => {
  it('throws E_VERCEL_NOT_FOUND when deployment does not exist', async () => {
    server.use(
      http.post(
        'https://api.vercel.com/v10/projects/my-app/promote/dpl_missing',
        () =>
          HttpResponse.json(
            { error: { code: 'not_found', message: 'Deployment not found.' } },
            { status: 404 },
          ),
      ),
    );
    await expect(rollback(cfg, stubProject, 'dpl_missing')).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      phase: 'rollback',
    });
  });
});

// ---------------------------------------------------------------------------
// mapReadyState — all documented paths
// ---------------------------------------------------------------------------

describe('mapReadyState', () => {
  it.each([
    ['READY', 'success'],
    ['BUILDING', 'building'],
    ['INITIALIZING', 'building'],
    ['QUEUED', 'building'],
    ['ERROR', 'failed'],
    ['CANCELED', 'canceled'],
    ['UNKNOWN_FUTURE_STATE', 'queued'],
    ['', 'queued'],
  ] as [string, string][])(
    'mapReadyState(%s) === %s',
    (input, expected) => {
      expect(mapReadyState(input)).toBe(expected);
    },
  );
});

// ---------------------------------------------------------------------------
// mapDeployment — uid fallback
// ---------------------------------------------------------------------------

describe('mapDeployment', () => {
  it('uses json.uid as id when json.id is absent', () => {
    const result = mapDeployment({
      uid: 'dpl_from_uid',
      url: 'test.vercel.app',
      readyState: 'READY',
      target: 'production',
      createdAt: '2026-05-07T10:00:00.000Z',
    });
    expect(result.id).toBe('dpl_from_uid');
  });

  it('prefers json.id over json.uid', () => {
    const result = mapDeployment({
      id: 'dpl_primary_id',
      uid: 'dpl_fallback_uid',
      url: 'test.vercel.app',
      readyState: 'READY',
      target: 'production',
      createdAt: '2026-05-07T10:00:00.000Z',
    });
    expect(result.id).toBe('dpl_primary_id');
  });
});
