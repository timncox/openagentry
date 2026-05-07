import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { githubFetch } from '../src/http.js';
import type { GithubRepoConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

const cfg: GithubRepoConfig = {
  token: 'ghp_test_secret_token',
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

describe('githubFetch — happy path GET', () => {
  it('returns parsed JSON on a successful GET', async () => {
    server.use(
      http.get(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json({ name: 'hello-world', private: false }),
      ),
    );
    const result = await githubFetch(cfg, 'GET', '/repos/octocat/hello-world', undefined, 'read');
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ name: 'hello-world', private: false });
  });

  it('json is null on a 204 No Content response (e.g. DELETE success)', async () => {
    server.use(
      http.delete(`${API_BASE}/repos/octocat/to-delete`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await githubFetch(cfg, 'DELETE', '/repos/octocat/to-delete', undefined, 'delete');
    expect(result.status).toBe(204);
    expect(result.json).toBeNull();
  });

  it('returns headers on the response object', async () => {
    server.use(
      http.get(`${API_BASE}/user`, () =>
        HttpResponse.json(
          { login: 'octocat' },
          { headers: { 'X-RateLimit-Remaining': '59' } },
        ),
      ),
    );
    const result = await githubFetch(cfg, 'GET', '/user', undefined, 'read');
    expect(result.headers.get('X-RateLimit-Remaining')).toBe('59');
  });
});

// ---------------------------------------------------------------------------
// Required headers
// ---------------------------------------------------------------------------

describe('githubFetch — required request headers', () => {
  it('sends Authorization: Bearer <token>', async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get(`${API_BASE}/user`, ({ request }) => {
        capturedAuth = request.headers.get('authorization');
        return HttpResponse.json({ login: 'octocat' });
      }),
    );
    await githubFetch(cfg, 'GET', '/user', undefined, 'read');
    expect(capturedAuth).toBe('Bearer ghp_test_secret_token');
  });

  it('sends Accept: application/vnd.github+json', async () => {
    let capturedAccept: string | null = null;
    server.use(
      http.get(`${API_BASE}/user`, ({ request }) => {
        capturedAccept = request.headers.get('accept');
        return HttpResponse.json({ login: 'octocat' });
      }),
    );
    await githubFetch(cfg, 'GET', '/user', undefined, 'read');
    expect(capturedAccept).toBe('application/vnd.github+json');
  });

  it('sends X-GitHub-Api-Version: 2022-11-28', async () => {
    let capturedVersion: string | null = null;
    server.use(
      http.get(`${API_BASE}/user`, ({ request }) => {
        capturedVersion = request.headers.get('x-github-api-version');
        return HttpResponse.json({ login: 'octocat' });
      }),
    );
    await githubFetch(cfg, 'GET', '/user', undefined, 'read');
    expect(capturedVersion).toBe('2022-11-28');
  });
});

// ---------------------------------------------------------------------------
// POST with body
// ---------------------------------------------------------------------------

describe('githubFetch — POST with JSON body', () => {
  it('sends Content-Type: application/json when body is present', async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${API_BASE}/user/repos`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ name: 'new-repo', private: true }, { status: 201 });
      }),
    );
    await githubFetch(cfg, 'POST', '/user/repos', { name: 'new-repo', private: true }, 'createProject');
    expect(capturedContentType).toBe('application/json');
  });

  it('serializes the body as JSON', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ name: 'new-repo' }, { status: 201 });
      }),
    );
    await githubFetch(
      cfg,
      'POST',
      '/user/repos',
      { name: 'new-repo', private: false, auto_init: true },
      'createProject',
    );
    expect(capturedBody).toMatchObject({ name: 'new-repo', private: false, auto_init: true });
  });

  it('does not send Content-Type when body is undefined', async () => {
    let capturedContentType: string | null = 'sentinel';
    server.use(
      http.get(`${API_BASE}/user`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ login: 'octocat' });
      }),
    );
    await githubFetch(cfg, 'GET', '/user', undefined, 'read');
    expect(capturedContentType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 401
// ---------------------------------------------------------------------------

describe('githubFetch — 401 → E_GITHUB_AUTH', () => {
  it('throws E_GITHUB_AUTH for HTTP 401', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_AUTH', phase: 'read' });
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 403 primary rate limit
// ---------------------------------------------------------------------------

describe('githubFetch — 403 rate-limit (X-RateLimit-Remaining: 0) → E_GITHUB_RATE_LIMIT', () => {
  it('throws E_GITHUB_RATE_LIMIT with retryAfter when X-RateLimit-Remaining is 0', async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 30; // 30 seconds from now
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json(
          { message: 'API rate limit exceeded' },
          {
            status: 403,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(resetEpoch),
            },
          },
        ),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_RATE_LIMIT', phase: 'read' });
  });

  it('retryAfter is populated in context from X-RateLimit-Reset', async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 60;
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json(
          { message: 'API rate limit exceeded' },
          {
            status: 403,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(resetEpoch),
            },
          },
        ),
      ),
    );
    try {
      await githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_GITHUB_RATE_LIMIT' });
      const retryAfter = (err as { context?: { retryAfter?: number } }).context?.retryAfter;
      expect(typeof retryAfter).toBe('number');
      expect(retryAfter).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 403 secondary rate limit
// ---------------------------------------------------------------------------

describe('githubFetch — 403 secondary rate-limit (message body) → E_GITHUB_RATE_LIMIT', () => {
  it('throws E_GITHUB_RATE_LIMIT when body message indicates secondary rate limit', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json(
          {
            message:
              'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
          },
          {
            status: 403,
            headers: { 'Retry-After': '45' },
          },
        ),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_RATE_LIMIT', phase: 'read' });
  });

  it('retryAfter comes from Retry-After header for secondary rate limit', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json(
          { message: 'You have exceeded a secondary rate limit and have been temporarily blocked.' },
          {
            status: 403,
            headers: { 'Retry-After': '30' },
          },
        ),
      ),
    );
    try {
      await githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_GITHUB_RATE_LIMIT' });
      const retryAfter = (err as { context?: { retryAfter?: number } }).context?.retryAfter;
      expect(retryAfter).toBe(30);
    }
  });

  it('retryAfter defaults to 60 when Retry-After header is absent', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json(
          { message: 'You have exceeded a secondary rate limit.' },
          { status: 403 },
        ),
      ),
    );
    try {
      await githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_GITHUB_RATE_LIMIT' });
      const retryAfter = (err as { context?: { retryAfter?: number } }).context?.retryAfter;
      expect(retryAfter).toBe(60);
    }
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 403 permission
// ---------------------------------------------------------------------------

describe('githubFetch — 403 plain → E_GITHUB_PERMISSION', () => {
  it('throws E_GITHUB_PERMISSION for plain 403 without rate-limit indicators', async () => {
    server.use(
      http.get(`${API_BASE}/repos/private-org/private-repo`, () =>
        HttpResponse.json(
          { message: 'Must have admin rights to Repository.' },
          { status: 403 },
        ),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/private-org/private-repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_PERMISSION', phase: 'read' });
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 404
// ---------------------------------------------------------------------------

describe('githubFetch — 404 → E_GITHUB_NOT_FOUND', () => {
  it('throws E_GITHUB_NOT_FOUND for HTTP 404', async () => {
    server.use(
      http.get(`${API_BASE}/repos/no-such-owner/no-such-repo`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/no-such-owner/no-such-repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_NOT_FOUND', phase: 'read' });
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 422
// ---------------------------------------------------------------------------

describe('githubFetch — 422 → E_GITHUB_INVALID', () => {
  it('throws E_GITHUB_INVALID for HTTP 422', async () => {
    server.use(
      http.post(`${API_BASE}/user/repos`, () =>
        HttpResponse.json(
          {
            message: 'Repository creation failed.',
            errors: [{ resource: 'Repository', code: 'custom', message: 'name already exists on this account' }],
          },
          { status: 422 },
        ),
      ),
    );
    await expect(
      githubFetch(cfg, 'POST', '/user/repos', { name: 'existing-repo' }, 'createProject'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'createProject' });
  });

  it('includes githubErrorMessage in context for 422', async () => {
    server.use(
      http.post(`${API_BASE}/user/repos`, () =>
        HttpResponse.json(
          { message: 'Repository creation failed.', errors: [] },
          { status: 422 },
        ),
      ),
    );
    try {
      await githubFetch(cfg, 'POST', '/user/repos', { name: 'bad-name!' }, 'createProject');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_GITHUB_INVALID' });
      const githubErrorMessage = (err as { context?: { githubErrorMessage?: string } }).context?.githubErrorMessage;
      expect(typeof githubErrorMessage).toBe('string');
      expect(githubErrorMessage).toContain('Repository creation failed');
    }
  });
});

// ---------------------------------------------------------------------------
// Error code mapping — 500/503
// ---------------------------------------------------------------------------

describe('githubFetch — 500 → E_GITHUB_UPSTREAM', () => {
  it('throws E_GITHUB_UPSTREAM for HTTP 500', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_UPSTREAM', phase: 'read' });
  });

  it('throws E_GITHUB_UPSTREAM for HTTP 503', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        new HttpResponse('Service Unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_UPSTREAM' });
  });
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe('githubFetch — network failure → E_GITHUB_NETWORK', () => {
  it('throws E_GITHUB_NETWORK when fetch rejects (MSW network error)', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () => HttpResponse.error()),
    );
    await expect(
      githubFetch(cfg, 'GET', '/repos/owner/repo', undefined, 'read'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_NETWORK', phase: 'read' });
  });

  it('E_GITHUB_NETWORK error has cause set', async () => {
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.error()),
    );
    try {
      await githubFetch(cfg, 'GET', '/user', undefined, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_GITHUB_NETWORK' });
      expect((err as { cause?: unknown }).cause).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// GHE Server endpoint
// ---------------------------------------------------------------------------

describe('githubFetch — GitHub Enterprise Server endpoint', () => {
  it('constructs the URL from cfg.endpoint + path', async () => {
    const gheCfg: GithubRepoConfig = {
      token: 'ghp_ghe_token',
      endpoint: 'https://github.example.com/api/v3',
    };
    let capturedUrl: string | undefined;
    server.use(
      http.get('https://github.example.com/api/v3/repos/myorg/myrepo', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ name: 'myrepo' });
      }),
    );
    await githubFetch(gheCfg, 'GET', '/repos/myorg/myrepo', undefined, 'read');
    expect(capturedUrl).toBe('https://github.example.com/api/v3/repos/myorg/myrepo');
  });
});
