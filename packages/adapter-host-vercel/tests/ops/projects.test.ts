import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createProject, destroyProject } from '../../src/ops/projects.js';
import type { VercelHostConfig } from '../../src/config.js';
import { VERCEL_ERROR_CODES } from '../../src/errors.js';
import type { HostProject } from '@openagentry/core';

const cfg: VercelHostConfig = {
  token: 'test_token_abc',
  endpoint: 'https://api.vercel.com',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prj_abc123',
    name: 'my-app',
    createdAt: '2026-05-07T10:00:00.000Z',
    ...overrides,
  };
}

const createOpts = {
  name: 'My App',
  slug: 'my-app',
};

const stubProject: HostProject = {
  id: 'prj_abc123',
  hostId: 'prj_abc123',
  name: 'My App',
  slug: 'my-app',
  createdAt: '2026-05-07T10:00:00.000Z' as unknown as import('@openagentry/core').IsoTimestamp,
};

// ---------------------------------------------------------------------------
// createProject — happy path
// ---------------------------------------------------------------------------

describe('createProject — happy path', () => {
  it('returns a correctly-shaped HostProject on 200', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(projectJson()),
      ),
    );
    const result = await createProject(cfg, createOpts);
    expect(result.id).toBe('prj_abc123');
    expect(result.hostId).toBe('prj_abc123');
    expect(result.name).toBe('My App');
    expect(result.slug).toBe('my-app');
    expect(result.createdAt).toBe('2026-05-07T10:00:00.000Z');
  });

  it('sends opts.slug as the project name in request body', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('https://api.vercel.com/v11/projects', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(projectJson());
      }),
    );
    await createProject(cfg, { name: 'My App', slug: 'my-app' });
    expect((capturedBody as Record<string, unknown>)['name']).toBe('my-app');
  });

  it('includes framework in body when opts.framework is set', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('https://api.vercel.com/v11/projects', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(projectJson());
      }),
    );
    await createProject(cfg, { name: 'My App', slug: 'my-app', framework: 'nextjs' });
    expect((capturedBody as Record<string, unknown>)['framework']).toBe('nextjs');
  });

  it('omits framework from body when opts.framework is undefined', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('https://api.vercel.com/v11/projects', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(projectJson());
      }),
    );
    await createProject(cfg, { name: 'My App', slug: 'my-app' });
    expect('framework' in (capturedBody as Record<string, unknown>)).toBe(false);
  });

  it('maps opts.name (not json.name) to the HostProject name field', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        // Vercel returns the slug in json.name; display name comes from opts.name
        HttpResponse.json(projectJson({ name: 'my-app' })),
      ),
    );
    const result = await createProject(cfg, { name: 'My Display Name', slug: 'my-app' });
    expect(result.name).toBe('My Display Name');
    expect(result.slug).toBe('my-app');
  });
});

// ---------------------------------------------------------------------------
// createProject — error paths
// ---------------------------------------------------------------------------

describe('createProject — conflict errors → UPSTREAM / INVALID', () => {
  it('throws E_VERCEL_UPSTREAM on 409 name conflict (409 maps to UPSTREAM per error module)', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(
          { error: { code: 'project_already_exists', message: 'A project with that name already exists.' } },
          { status: 409 },
        ),
      ),
    );
    await expect(createProject(cfg, createOpts)).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.UPSTREAM,
    });
  });

  it('throws E_VERCEL_INVALID on 422 validation failure', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(
          { error: { code: 'invalid_name', message: 'Project name contains invalid characters.' } },
          { status: 422 },
        ),
      ),
    );
    await expect(createProject(cfg, createOpts)).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.INVALID,
    });
  });
});

describe('createProject — 401 → AUTH', () => {
  it('throws E_VERCEL_AUTH on 401', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(
          { error: { code: 'forbidden', message: 'Not authenticated.' } },
          { status: 401 },
        ),
      ),
    );
    await expect(createProject(cfg, createOpts)).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.AUTH,
      phase: 'createProject',
    });
  });
});

// ---------------------------------------------------------------------------
// destroyProject — happy path
// ---------------------------------------------------------------------------

describe('destroyProject — happy path', () => {
  it('resolves void on 204 (project deleted)', async () => {
    server.use(
      http.delete('https://api.vercel.com/v9/projects/my-app', () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(
      destroyProject(cfg, stubProject, 'confirm-delete' as unknown as import('@openagentry/core').ConfirmToken),
    ).resolves.toBeUndefined();
  });

  it('uses p.slug in the DELETE URL', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.delete('https://api.vercel.com/v9/projects/specific-slug', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const p = { ...stubProject, slug: 'specific-slug' };
    await destroyProject(
      cfg,
      p,
      'confirm-delete' as unknown as import('@openagentry/core').ConfirmToken,
    );
    expect(capturedUrl).toContain('/v9/projects/specific-slug');
  });
});

// ---------------------------------------------------------------------------
// destroyProject — ConfirmToken validation
// ---------------------------------------------------------------------------

describe('destroyProject — ConfirmToken validation', () => {
  it('throws E_VERCEL_INVALID with phase destroyProject when token is empty string', async () => {
    await expect(
      destroyProject(cfg, stubProject, '' as unknown as import('@openagentry/core').ConfirmToken),
    ).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.INVALID,
      phase: 'destroyProject',
    });
  });

  it('throws E_VERCEL_INVALID when token is null (cast through unknown)', async () => {
    await expect(
      destroyProject(
        cfg,
        stubProject,
        null as unknown as import('@openagentry/core').ConfirmToken,
      ),
    ).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.INVALID,
      phase: 'destroyProject',
    });
  });

  it('does NOT make any HTTP request when token is invalid', async () => {
    // Server has onUnhandledRequest: 'error' — any HTTP call would throw.
    // If this resolves (by throwing INVALID before the fetch), the test passes.
    await expect(
      destroyProject(cfg, stubProject, '' as unknown as import('@openagentry/core').ConfirmToken),
    ).rejects.toMatchObject({ code: VERCEL_ERROR_CODES.INVALID });
  });
});

// ---------------------------------------------------------------------------
// destroyProject — 404 → NOT_FOUND
// ---------------------------------------------------------------------------

describe('destroyProject — 404 → NOT_FOUND', () => {
  it('throws E_VERCEL_NOT_FOUND when project does not exist', async () => {
    server.use(
      http.delete('https://api.vercel.com/v9/projects/my-app', () =>
        HttpResponse.json(
          { error: { code: 'not_found', message: 'Project not found.' } },
          { status: 404 },
        ),
      ),
    );
    await expect(
      destroyProject(
        cfg,
        stubProject,
        'confirm-delete' as unknown as import('@openagentry/core').ConfirmToken,
      ),
    ).rejects.toMatchObject({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      phase: 'destroyProject',
    });
  });
});
