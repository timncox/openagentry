import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getOp } from '../src/get.js';
import type { GithubRepoConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

const cfg: GithubRepoConfig = {
  token: 'ghp_test_token',
  endpoint: API_BASE,
};

// A minimal but realistic GET /repos response from GitHub.
const REPO_RESPONSE = {
  id: 123456,
  name: 'hello-world',
  full_name: 'octocat/hello-world',
  owner: { login: 'octocat', id: 1 },
  private: false,
  html_url: 'https://github.com/octocat/hello-world',
  description: 'This your first repo!',
  default_branch: 'main',
  visibility: 'public',
};

const PRIVATE_REPO_RESPONSE = {
  ...REPO_RESPONSE,
  name: 'secret-project',
  full_name: 'acme-org/secret-project',
  owner: { login: 'acme-org', id: 99 },
  private: true,
  html_url: 'https://github.com/acme-org/secret-project',
  default_branch: 'master',
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
// Happy path — found
// ---------------------------------------------------------------------------

describe('getOp — found', () => {
  it('returns a Repository with correct fields for a public repo', async () => {
    server.use(
      http.get(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json(REPO_RESPONSE),
      ),
    );
    const result = await getOp(cfg, 'octocat', 'hello-world');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      owner: 'octocat',
      name: 'hello-world',
      url: 'https://github.com/octocat/hello-world',
      defaultBranch: 'main',
      visibility: 'public',
    });
  });

  it('maps private: true → visibility: "private"', async () => {
    server.use(
      http.get(`${API_BASE}/repos/acme-org/secret-project`, () =>
        HttpResponse.json(PRIVATE_REPO_RESPONSE),
      ),
    );
    const result = await getOp(cfg, 'acme-org', 'secret-project');
    expect(result).not.toBeNull();
    expect(result?.visibility).toBe('private');
    expect(result?.defaultBranch).toBe('master');
  });

  it('maps private: false → visibility: "public"', async () => {
    server.use(
      http.get(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json(REPO_RESPONSE),
      ),
    );
    const result = await getOp(cfg, 'octocat', 'hello-world');
    expect(result?.visibility).toBe('public');
  });

  it('uses owner.login (not full_name prefix) for the owner field', async () => {
    server.use(
      http.get(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json(REPO_RESPONSE),
      ),
    );
    const result = await getOp(cfg, 'octocat', 'hello-world');
    expect(result?.owner).toBe('octocat');
  });

  it('uses html_url for the url field', async () => {
    server.use(
      http.get(`${API_BASE}/repos/octocat/hello-world`, () =>
        HttpResponse.json(REPO_RESPONSE),
      ),
    );
    const result = await getOp(cfg, 'octocat', 'hello-world');
    expect(result?.url).toBe('https://github.com/octocat/hello-world');
  });
});

// ---------------------------------------------------------------------------
// Not found — 404 → null
// ---------------------------------------------------------------------------

describe('getOp — not found (404 → null)', () => {
  it('returns null when GitHub returns 404', async () => {
    server.use(
      http.get(`${API_BASE}/repos/no-such-owner/no-such-repo`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    const result = await getOp(cfg, 'no-such-owner', 'no-such-repo');
    expect(result).toBeNull();
  });

  it('returns null regardless of 404 body content', async () => {
    server.use(
      http.get(`${API_BASE}/repos/gone/gone`, () =>
        HttpResponse.json(
          { message: 'Not Found', documentation_url: 'https://docs.github.com/rest' },
          { status: 404 },
        ),
      ),
    );
    const result = await getOp(cfg, 'gone', 'gone');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth errors propagate
// ---------------------------------------------------------------------------

describe('getOp — auth errors propagate', () => {
  it('throws E_GITHUB_AUTH for 401 (does not swallow)', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    );
    await expect(getOp(cfg, 'owner', 'repo')).rejects.toMatchObject({
      code: 'E_GITHUB_AUTH',
      phase: 'read',
    });
  });
});

// ---------------------------------------------------------------------------
// Permission errors propagate
// ---------------------------------------------------------------------------

describe('getOp — permission errors propagate', () => {
  it('throws E_GITHUB_PERMISSION for plain 403', async () => {
    server.use(
      http.get(`${API_BASE}/repos/private-org/locked`, () =>
        HttpResponse.json({ message: 'Must have admin rights to Repository.' }, { status: 403 }),
      ),
    );
    await expect(getOp(cfg, 'private-org', 'locked')).rejects.toMatchObject({
      code: 'E_GITHUB_PERMISSION',
      phase: 'read',
    });
  });
});

// ---------------------------------------------------------------------------
// Network errors propagate
// ---------------------------------------------------------------------------

describe('getOp — network errors propagate', () => {
  it('throws E_GITHUB_NETWORK on fetch-level failure', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () => HttpResponse.error()),
    );
    await expect(getOp(cfg, 'owner', 'repo')).rejects.toMatchObject({
      code: 'E_GITHUB_NETWORK',
      phase: 'read',
    });
  });
});

// ---------------------------------------------------------------------------
// Upstream errors propagate
// ---------------------------------------------------------------------------

describe('getOp — upstream errors propagate', () => {
  it('throws E_GITHUB_UPSTREAM for 500', async () => {
    server.use(
      http.get(`${API_BASE}/repos/owner/repo`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    await expect(getOp(cfg, 'owner', 'repo')).rejects.toMatchObject({
      code: 'E_GITHUB_UPSTREAM',
      phase: 'read',
    });
  });
});

// ---------------------------------------------------------------------------
// GHE endpoint
// ---------------------------------------------------------------------------

describe('getOp — GitHub Enterprise Server endpoint', () => {
  it('constructs the URL from cfg.endpoint', async () => {
    const gheCfg: GithubRepoConfig = {
      token: 'ghp_ghe_token',
      endpoint: 'https://github.example.com/api/v3',
    };
    let capturedUrl: string | undefined;
    server.use(
      http.get('https://github.example.com/api/v3/repos/myorg/myrepo', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          ...REPO_RESPONSE,
          name: 'myrepo',
          owner: { login: 'myorg', id: 9 },
          html_url: 'https://github.example.com/myorg/myrepo',
        });
      }),
    );
    await getOp(gheCfg, 'myorg', 'myrepo');
    expect(capturedUrl).toBe('https://github.example.com/api/v3/repos/myorg/myrepo');
  });
});
