import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createOp, getAuthenticatedLogin } from '../src/create.js';
import type { GithubRepoConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

/** Create a *unique* cfg object per test so WeakMap login cache is isolated. */
function makeCfg(token = 'ghp_test_token'): GithubRepoConfig {
  return { token, endpoint: API_BASE };
}

const USER_RESPONSE = { login: 'octocat', id: 1 };

const PERSONAL_REPO_RESPONSE = {
  id: 999,
  name: 'my-new-repo',
  full_name: 'octocat/my-new-repo',
  owner: { login: 'octocat', id: 1 },
  private: false,
  html_url: 'https://github.com/octocat/my-new-repo',
  description: 'Test repo',
  default_branch: 'main',
  visibility: 'public',
};

const ORG_REPO_RESPONSE = {
  id: 888,
  name: 'org-repo',
  full_name: 'acme-org/org-repo',
  owner: { login: 'acme-org', id: 42 },
  private: true,
  html_url: 'https://github.com/acme-org/org-repo',
  description: null,
  default_branch: 'main',
  visibility: 'private',
};

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// getAuthenticatedLogin — probe + cache
// ---------------------------------------------------------------------------

describe('getAuthenticatedLogin — probe + cache', () => {
  it('returns the login from GET /user', async () => {
    const cfg = makeCfg();
    server.use(http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)));
    const login = await getAuthenticatedLogin(cfg);
    expect(login).toBe('octocat');
  });

  it('caches the login: GET /user is only called once across multiple calls', async () => {
    const cfg = makeCfg('ghp_cache_token');
    let probeCount = 0;
    server.use(
      http.get(`${API_BASE}/user`, () => {
        probeCount++;
        return HttpResponse.json(USER_RESPONSE);
      }),
    );
    // Call three times — probe should only fire once.
    await getAuthenticatedLogin(cfg);
    await getAuthenticatedLogin(cfg);
    await getAuthenticatedLogin(cfg);
    expect(probeCount).toBe(1);
  });

  it('cache is per-config-instance (distinct objects get distinct cache entries)', async () => {
    const cfgA = makeCfg('ghp_token_a');
    const cfgB = makeCfg('ghp_token_b');
    let probeCount = 0;
    server.use(
      http.get(`${API_BASE}/user`, () => {
        probeCount++;
        return HttpResponse.json(USER_RESPONSE);
      }),
    );
    await getAuthenticatedLogin(cfgA);
    await getAuthenticatedLogin(cfgB);
    // Two different cfg objects → two probe calls.
    expect(probeCount).toBe(2);
  });

  it('throws E_GITHUB_AUTH when probe returns 401', async () => {
    const cfg = makeCfg('ghp_bad_token');
    server.use(
      http.get(`${API_BASE}/user`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    );
    await expect(getAuthenticatedLogin(cfg)).rejects.toMatchObject({
      code: 'E_GITHUB_AUTH',
      phase: 'createProject',
    });
  });
});

// ---------------------------------------------------------------------------
// createOp — personal repo (owner === login)
// ---------------------------------------------------------------------------

describe('createOp — personal repo (owner === authenticated login)', () => {
  it('POSTs to /user/repos when owner matches the authenticated login', async () => {
    const cfg = makeCfg();
    let capturedPath: string | undefined;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(capturedPath).toBe('/user/repos');
  });

  it('returns a correctly mapped Repository for a personal public repo', async () => {
    const cfg = makeCfg();
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, () =>
        HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 }),
      ),
    );
    const result = await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(result).toMatchObject({
      owner: 'octocat',
      name: 'my-new-repo',
      url: 'https://github.com/octocat/my-new-repo',
      defaultBranch: 'main',
      visibility: 'public',
    });
  });
});

// ---------------------------------------------------------------------------
// createOp — org repo (owner !== login)
// ---------------------------------------------------------------------------

describe('createOp — org repo (owner !== authenticated login)', () => {
  it('POSTs to /orgs/{owner}/repos when owner differs from the authenticated login', async () => {
    const cfg = makeCfg();
    let capturedPath: string | undefined;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/orgs/acme-org/repos`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(ORG_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'acme-org',
      name: 'org-repo',
      visibility: 'private',
    });
    expect(capturedPath).toBe('/orgs/acme-org/repos');
  });

  it('returns a correctly mapped Repository for an org private repo', async () => {
    const cfg = makeCfg();
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/orgs/acme-org/repos`, () =>
        HttpResponse.json(ORG_REPO_RESPONSE, { status: 201 }),
      ),
    );
    const result = await createOp(cfg, {
      owner: 'acme-org',
      name: 'org-repo',
      visibility: 'private',
    });
    expect(result).toMatchObject({
      owner: 'acme-org',
      name: 'org-repo',
      visibility: 'private',
    });
  });
});

// ---------------------------------------------------------------------------
// createOp — request body serialization
// ---------------------------------------------------------------------------

describe('createOp — request body', () => {
  it('sends private: true for visibility "private"', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...PERSONAL_REPO_RESPONSE, private: true },
          { status: 201 },
        );
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'private-repo',
      visibility: 'private',
    });
    expect(capturedBody?.private).toBe(true);
  });

  it('sends private: false for visibility "public"', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(capturedBody?.private).toBe(false);
  });

  it('sends auto_init: true when initWithReadme is true', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
      initWithReadme: true,
    });
    expect(capturedBody?.auto_init).toBe(true);
  });

  it('sends auto_init: false when initWithReadme is omitted', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(capturedBody?.auto_init).toBe(false);
  });

  it('includes description in body when provided', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
      description: 'A test repository',
    });
    expect(capturedBody?.description).toBe('A test repository');
  });

  it('omits description from body when not provided (undefined stripped)', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(Object.prototype.hasOwnProperty.call(capturedBody, 'description')).toBe(false);
  });

  it('includes default_branch in body when provided', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...PERSONAL_REPO_RESPONSE, default_branch: 'trunk' },
          { status: 201 },
        );
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
      defaultBranch: 'trunk',
    });
    expect(capturedBody?.default_branch).toBe('trunk');
  });

  it('omits default_branch from body when not provided (undefined stripped)', async () => {
    const cfg = makeCfg();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, {
      owner: 'octocat',
      name: 'my-new-repo',
      visibility: 'public',
    });
    expect(Object.prototype.hasOwnProperty.call(capturedBody, 'default_branch')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createOp — login probe caching (within createOp calls)
// ---------------------------------------------------------------------------

describe('createOp — login probe is cached across calls', () => {
  it('GET /user is called only once for multiple createOp calls on the same cfg', async () => {
    const cfg = makeCfg('ghp_cached_create_token');
    let probeCount = 0;
    let createCount = 0;
    server.use(
      http.get(`${API_BASE}/user`, () => {
        probeCount++;
        return HttpResponse.json(USER_RESPONSE);
      }),
      http.post(`${API_BASE}/user/repos`, () => {
        createCount++;
        return HttpResponse.json(PERSONAL_REPO_RESPONSE, { status: 201 });
      }),
    );
    await createOp(cfg, { owner: 'octocat', name: 'repo-one', visibility: 'public' });
    await createOp(cfg, { owner: 'octocat', name: 'repo-two', visibility: 'public' });
    expect(probeCount).toBe(1);
    expect(createCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createOp — error propagation
// ---------------------------------------------------------------------------

describe('createOp — error propagation', () => {
  it('throws E_GITHUB_INVALID for 422 (name conflict)', async () => {
    const cfg = makeCfg();
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
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
      createOp(cfg, { owner: 'octocat', name: 'existing-repo', visibility: 'public' }),
    ).rejects.toMatchObject({ code: 'E_GITHUB_INVALID', phase: 'createProject' });
  });

  it('throws E_GITHUB_PERMISSION for 403', async () => {
    const cfg = makeCfg();
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/orgs/locked-org/repos`, () =>
        HttpResponse.json({ message: 'Must have admin rights to Repository.' }, { status: 403 }),
      ),
    );
    await expect(
      createOp(cfg, { owner: 'locked-org', name: 'new-repo', visibility: 'public' }),
    ).rejects.toMatchObject({ code: 'E_GITHUB_PERMISSION', phase: 'createProject' });
  });

  it('throws E_GITHUB_NETWORK on fetch failure during create', async () => {
    const cfg = makeCfg();
    server.use(
      http.get(`${API_BASE}/user`, () => HttpResponse.json(USER_RESPONSE)),
      http.post(`${API_BASE}/user/repos`, () => HttpResponse.error()),
    );
    await expect(
      createOp(cfg, { owner: 'octocat', name: 'my-new-repo', visibility: 'public' }),
    ).rejects.toMatchObject({ code: 'E_GITHUB_NETWORK', phase: 'createProject' });
  });
});

// ---------------------------------------------------------------------------
// createOp — GHE endpoint
// ---------------------------------------------------------------------------

describe('createOp — GitHub Enterprise Server endpoint', () => {
  it('constructs the URL from cfg.endpoint', async () => {
    const gheCfg: GithubRepoConfig = {
      token: 'ghp_ghe_token',
      endpoint: 'https://github.example.com/api/v3',
    };
    let capturedUrl: string | undefined;
    server.use(
      http.get('https://github.example.com/api/v3/user', () =>
        HttpResponse.json({ login: 'ghe-user', id: 7 }),
      ),
      http.post('https://github.example.com/api/v3/user/repos', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          ...PERSONAL_REPO_RESPONSE,
          owner: { login: 'ghe-user', id: 7 },
          html_url: 'https://github.example.com/ghe-user/ghe-repo',
        }, { status: 201 });
      }),
    );
    await createOp(gheCfg, {
      owner: 'ghe-user',
      name: 'ghe-repo',
      visibility: 'public',
    });
    expect(capturedUrl).toBe('https://github.example.com/api/v3/user/repos');
  });
});
