import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { vercelFetch } from '../src/http.js';
import type { VercelHostConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.vercel.com';

const cfg: VercelHostConfig = {
  token: 'vercel_test_secret_token',
  endpoint: API_BASE,
};

const cfgWithTeam: VercelHostConfig = {
  token: 'vercel_test_secret_token',
  teamId: 'team_abc123',
  endpoint: API_BASE,
};

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('vercelFetch — happy path GET', () => {
  it('returns parsed JSON on a successful GET', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json({ id: 'prj_abc', name: 'my-project' }),
      ),
    );
    const result = await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ id: 'prj_abc', name: 'my-project' });
  });

  it('json is null on a 204 No Content response (e.g. DELETE success)', async () => {
    server.use(
      http.delete(`${API_BASE}/v9/projects/my-project`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await vercelFetch(cfg, 'DELETE', '/v9/projects/my-project', undefined, 'destroyProject');
    expect(result.status).toBe(204);
    expect(result.json).toBeNull();
  });

  it('json is null on a 205 Reset Content response', async () => {
    server.use(
      http.post(`${API_BASE}/v1/some-reset`, () =>
        new HttpResponse(null, { status: 205 }),
      ),
    );
    const result = await vercelFetch(cfg, 'POST', '/v1/some-reset', undefined, 'deploy');
    expect(result.status).toBe(205);
    expect(result.json).toBeNull();
  });

  it('returns headers on the response object', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json(
          { id: 'prj_abc', name: 'my-project' },
          { headers: { 'X-Vercel-Id': 'req_xyz' } },
        ),
      ),
    );
    const result = await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(result.headers.get('X-Vercel-Id')).toBe('req_xyz');
  });
});

// ---------------------------------------------------------------------------
// Required headers
// ---------------------------------------------------------------------------

describe('vercelFetch — required request headers', () => {
  it('sends Authorization: Bearer <token>', async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        capturedAuth = request.headers.get('authorization');
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedAuth).toBe('Bearer vercel_test_secret_token');
  });

  it('does not send Content-Type when body is undefined', async () => {
    let capturedContentType: string | null = 'sentinel';
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedContentType).toBeNull();
  });

  it('does not send extra unexpected headers', async () => {
    const capturedHeaderNames: string[] = [];
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        request.headers.forEach((_v, k) => capturedHeaderNames.push(k.toLowerCase()));
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    // Only authorization should be set (no content-type on GET with no body)
    expect(capturedHeaderNames).toContain('authorization');
    expect(capturedHeaderNames).not.toContain('content-type');
    // Should not contain github-style version or accept headers
    expect(capturedHeaderNames).not.toContain('x-github-api-version');
  });
});

// ---------------------------------------------------------------------------
// teamId query param
// ---------------------------------------------------------------------------

describe('vercelFetch — teamId query param', () => {
  it('appends ?teamId=... when teamId is configured and path has no query params', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfgWithTeam, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedUrl).toContain('?teamId=team_abc123');
    expect(capturedUrl).not.toContain('&&');
  });

  it('appends &teamId=... when path already has query params', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project/env`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ envs: [] });
      }),
    );
    await vercelFetch(
      cfgWithTeam,
      'GET',
      '/v9/projects/my-project/env?decrypt=true',
      undefined,
      'getEnv',
    );
    expect(capturedUrl).toContain('?decrypt=true');
    expect(capturedUrl).toContain('&teamId=team_abc123');
    expect(capturedUrl).not.toContain('?teamId');
  });

  it('does not append teamId when teamId is not configured', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedUrl).not.toContain('teamId');
  });

  it('URL-encodes teamId that contains special characters', async () => {
    const cfgSpecialTeam: VercelHostConfig = {
      token: 'tok',
      teamId: 'team abc+xyz',
      endpoint: API_BASE,
    };
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(cfgSpecialTeam, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedUrl).toContain('teamId=team%20abc%2Bxyz');
  });
});

// ---------------------------------------------------------------------------
// POST with body
// ---------------------------------------------------------------------------

describe('vercelFetch — POST with JSON body', () => {
  it('sends Content-Type: application/json when body is present', async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${API_BASE}/v11/projects`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ id: 'prj_new', name: 'new-project' }, { status: 200 });
      }),
    );
    await vercelFetch(cfg, 'POST', '/v11/projects', { name: 'new-project' }, 'createProject');
    expect(capturedContentType).toBe('application/json');
  });

  it('serializes the body as JSON', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API_BASE}/v11/projects`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'prj_new', name: 'new-project' }, { status: 200 });
      }),
    );
    await vercelFetch(
      cfg,
      'POST',
      '/v11/projects',
      { name: 'new-project', framework: 'nextjs' },
      'createProject',
    );
    expect(capturedBody).toMatchObject({ name: 'new-project', framework: 'nextjs' });
  });

  it('sends both Authorization and Content-Type when body is present', async () => {
    let capturedAuth: string | null = null;
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${API_BASE}/v11/projects`, ({ request }) => {
        capturedAuth = request.headers.get('authorization');
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ id: 'prj_new' }, { status: 200 });
      }),
    );
    await vercelFetch(cfg, 'POST', '/v11/projects', { name: 'test' }, 'createProject');
    expect(capturedAuth).toBe('Bearer vercel_test_secret_token');
    expect(capturedContentType).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Error code mapping
// ---------------------------------------------------------------------------

describe('vercelFetch — 401 → E_VERCEL_AUTH', () => {
  it('throws E_VERCEL_AUTH for HTTP 401', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json({ error: { code: 'forbidden', message: 'Invalid token' } }, { status: 401 }),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'read' });
  });
});

describe('vercelFetch — 403 → E_VERCEL_PERMISSION', () => {
  it('throws E_VERCEL_PERMISSION for HTTP 403', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/private-project`, () =>
        HttpResponse.json(
          { error: { code: 'forbidden', message: 'You do not have access to this project' } },
          { status: 403 },
        ),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/private-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_PERMISSION', phase: 'read' });
  });
});

describe('vercelFetch — 404 → E_VERCEL_NOT_FOUND', () => {
  it('throws E_VERCEL_NOT_FOUND for HTTP 404', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/no-such-project`, () =>
        HttpResponse.json({ error: { code: 'not_found', message: 'Project not found' } }, { status: 404 }),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/no-such-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_NOT_FOUND', phase: 'read' });
  });
});

describe('vercelFetch — 400 → E_VERCEL_INVALID', () => {
  it('throws E_VERCEL_INVALID for HTTP 400', async () => {
    server.use(
      http.post(`${API_BASE}/v11/projects`, () =>
        HttpResponse.json(
          { error: { code: 'bad_request', message: 'Invalid project name' } },
          { status: 400 },
        ),
      ),
    );
    await expect(
      vercelFetch(cfg, 'POST', '/v11/projects', { name: '!!bad!!' }, 'createProject'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_INVALID', phase: 'createProject' });
  });

  it('throws E_VERCEL_INVALID for HTTP 422', async () => {
    server.use(
      http.post(`${API_BASE}/v11/projects`, () =>
        HttpResponse.json(
          { error: { code: 'conflict', message: 'A project with this name already exists' } },
          { status: 422 },
        ),
      ),
    );
    await expect(
      vercelFetch(cfg, 'POST', '/v11/projects', { name: 'existing-project' }, 'createProject'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_INVALID', phase: 'createProject' });
  });
});

describe('vercelFetch — 429 → E_VERCEL_RATE_LIMIT', () => {
  it('throws E_VERCEL_RATE_LIMIT for HTTP 429', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json(
          { error: { code: 'rate_limited', message: 'Too Many Requests' } },
          { status: 429, headers: { 'Retry-After': '30' } },
        ),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_RATE_LIMIT', phase: 'read' });
  });

  it('429 → context.retryAfter populated from Retry-After header', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json(
          { error: { code: 'rate_limited', message: 'Too Many Requests' } },
          { status: 429, headers: { 'Retry-After': '45' } },
        ),
      ),
    );
    try {
      await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_VERCEL_RATE_LIMIT' });
      const retryAfter = (err as { context?: { retryAfter?: number } }).context?.retryAfter;
      expect(retryAfter).toBe(45);
    }
  });

  it('429 → context.retryAfter defaults to 60 when Retry-After header is absent', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json(
          { error: { code: 'rate_limited', message: 'Too Many Requests' } },
          { status: 429 },
        ),
      ),
    );
    try {
      await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_VERCEL_RATE_LIMIT' });
      const retryAfter = (err as { context?: { retryAfter?: number } }).context?.retryAfter;
      expect(retryAfter).toBe(60);
    }
  });
});

describe('vercelFetch — 500 → E_VERCEL_UPSTREAM', () => {
  it('throws E_VERCEL_UPSTREAM for HTTP 500', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        HttpResponse.json({ error: { code: 'internal_server_error', message: 'Internal Server Error' } }, { status: 500 }),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_UPSTREAM', phase: 'read' });
  });

  it('throws E_VERCEL_UPSTREAM for HTTP 503', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () =>
        new HttpResponse('Service Unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_UPSTREAM' });
  });
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe('vercelFetch — network failure → E_VERCEL_NETWORK', () => {
  it('throws E_VERCEL_NETWORK when fetch rejects (MSW network error)', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () => HttpResponse.error()),
    );
    await expect(
      vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_NETWORK', phase: 'read' });
  });

  it('E_VERCEL_NETWORK error has cause set', async () => {
    server.use(
      http.get(`${API_BASE}/v9/projects/my-project`, () => HttpResponse.error()),
    );
    try {
      await vercelFetch(cfg, 'GET', '/v9/projects/my-project', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_VERCEL_NETWORK' });
      expect((err as { cause?: unknown }).cause).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Custom endpoint (for testing/enterprise)
// ---------------------------------------------------------------------------

describe('vercelFetch — custom endpoint', () => {
  it('constructs the URL from cfg.endpoint + path', async () => {
    const customCfg: VercelHostConfig = {
      token: 'tok',
      endpoint: 'https://api.vercel.example.com',
    };
    let capturedUrl: string | undefined;
    server.use(
      http.get('https://api.vercel.example.com/v9/projects/my-project', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ id: 'prj_abc' });
      }),
    );
    await vercelFetch(customCfg, 'GET', '/v9/projects/my-project', undefined, 'read');
    expect(capturedUrl).toContain('https://api.vercel.example.com/v9/projects/my-project');
  });
});
