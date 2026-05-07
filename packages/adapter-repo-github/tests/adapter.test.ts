import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createGithubRepoAdapter } from '../src/adapter.js';
import { GITHUB_ERROR_CODES } from '../src/errors.js';

// ─── Canned JSON responses ────────────────────────────────────────────────────

const GITHUB_USER_RESPONSE = {
  login: 'oa-test-user',
  id: 12345,
};

const GITHUB_REPO_RESPONSE = {
  id: 9001,
  name: 'adapter-factory-test',
  owner: { login: 'oa-test-user' },
  html_url: 'https://github.com/oa-test-user/adapter-factory-test',
  default_branch: 'main',
  private: true,
  visibility: 'private',
  description: 'Factory smoke test',
};

const GITHUB_ORG_REPO_RESPONSE = {
  id: 9002,
  name: 'org-repo-test',
  owner: { login: 'oa-test-org' },
  html_url: 'https://github.com/oa-test-org/org-repo-test',
  default_branch: 'main',
  private: false,
  visibility: 'public',
  description: null,
};

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Shared config ────────────────────────────────────────────────────────────

const BASE_CFG = {
  token: 'ghp_test_token_factory',
};

// ─── Factory shape ────────────────────────────────────────────────────────────

describe('createGithubRepoAdapter — factory shape', () => {
  it('returns a frozen object', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('exposes category === "repo"', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    expect(adapter.category).toBe('repo');
  });

  it('exposes id === "repo-github"', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    expect(adapter.id).toBe('repo-github');
  });

  it('exposes all four RepoAdapter methods', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    expect(typeof adapter.create).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.remoteUrl).toBe('function');
  });
});

// ─── Config validation guard ──────────────────────────────────────────────────

describe('createGithubRepoAdapter — config validation', () => {
  it('throws when token is missing', () => {
    expect(() =>
      createGithubRepoAdapter({} as never),
    ).toThrow();
  });

  it('thrown error carries code E_GITHUB_SCHEMA', () => {
    try {
      createGithubRepoAdapter({} as never);
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe(GITHUB_ERROR_CODES.SCHEMA);
    }
  });

  it('throws when token is an empty string', () => {
    expect(() =>
      createGithubRepoAdapter({ token: '' }),
    ).toThrow();
  });

  it('throws when endpoint is not a valid URL', () => {
    expect(() =>
      createGithubRepoAdapter({ token: 'ghp_valid', endpoint: 'not-a-url' }),
    ).toThrow();
  });

  it('accepts valid token + optional endpoint', () => {
    expect(() =>
      createGithubRepoAdapter({
        token: 'ghp_valid',
        endpoint: 'https://github.example.com/api/v3',
      }),
    ).not.toThrow();
  });
});

// ─── remoteUrl is synchronous (not a Promise) ─────────────────────────────────

describe('createGithubRepoAdapter — remoteUrl is synchronous', () => {
  const REPO = {
    owner: 'oa-test-user',
    name: 'my-repo',
    url: 'https://github.com/oa-test-user/my-repo',
    defaultBranch: 'main',
    visibility: 'public' as const,
  };

  it('remoteUrl https mode returns a string synchronously', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const result = adapter.remoteUrl(REPO, 'https');
    expect(typeof result).toBe('string');
    expect(result).toBe('https://github.com/oa-test-user/my-repo.git');
  });

  it('remoteUrl ssh mode returns a string synchronously', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const result = adapter.remoteUrl(REPO, 'ssh');
    expect(typeof result).toBe('string');
    expect(result).toBe('git@github.com:oa-test-user/my-repo.git');
  });

  it('remoteUrl result is NOT a Promise', () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const result = adapter.remoteUrl(REPO, 'https');
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ─── Method delegation smoke tests ────────────────────────────────────────────

describe('createGithubRepoAdapter — method delegation', () => {
  it('create delegates to create.ts and returns a Repository (user-owned)', async () => {
    server.use(
      // Login probe
      http.get('https://api.github.com/user', () =>
        HttpResponse.json(GITHUB_USER_RESPONSE),
      ),
      // User-owned create
      http.post('https://api.github.com/user/repos', () =>
        HttpResponse.json(GITHUB_REPO_RESPONSE, { status: 201 }),
      ),
    );
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const repo = await adapter.create({
      owner: 'oa-test-user',
      name: 'adapter-factory-test',
      visibility: 'private',
    });
    expect(repo.owner).toBe('oa-test-user');
    expect(repo.name).toBe('adapter-factory-test');
    expect(repo.visibility).toBe('private');
    expect(repo.defaultBranch).toBe('main');
    expect(typeof repo.url).toBe('string');
  });

  it('create delegates to org endpoint for org-owned repos', async () => {
    server.use(
      http.get('https://api.github.com/user', () =>
        HttpResponse.json(GITHUB_USER_RESPONSE),
      ),
      http.post('https://api.github.com/orgs/oa-test-org/repos', () =>
        HttpResponse.json(GITHUB_ORG_REPO_RESPONSE, { status: 201 }),
      ),
    );
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const repo = await adapter.create({
      owner: 'oa-test-org',
      name: 'org-repo-test',
      visibility: 'public',
    });
    expect(repo.owner).toBe('oa-test-org');
    expect(repo.visibility).toBe('public');
  });

  it('get delegates to get.ts and returns Repository when found', async () => {
    server.use(
      http.get('https://api.github.com/repos/oa-test-user/adapter-factory-test', () =>
        HttpResponse.json(GITHUB_REPO_RESPONSE),
      ),
    );
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const repo = await adapter.get('oa-test-user', 'adapter-factory-test');
    expect(repo).not.toBeNull();
    expect(repo!.name).toBe('adapter-factory-test');
  });

  it('get returns null when repo is not found (404)', async () => {
    server.use(
      http.get('https://api.github.com/repos/nobody/no-such-repo', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const result = await adapter.get('nobody', 'no-such-repo');
    expect(result).toBeNull();
  });

  it('delete delegates to delete.ts and resolves for a valid ConfirmToken', async () => {
    server.use(
      http.delete('https://api.github.com/repos/oa-test-user/adapter-factory-test', () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const repo = {
      owner: 'oa-test-user',
      name: 'adapter-factory-test',
      url: 'https://github.com/oa-test-user/adapter-factory-test',
      defaultBranch: 'main',
      visibility: 'private' as const,
    };
    await expect(
      adapter.delete(repo, 'confirm-delete' as import('@openagentry/core').ConfirmToken),
    ).resolves.toBeUndefined();
  });

  it('delete throws E_GITHUB_INVALID when ConfirmToken is missing', async () => {
    const adapter = createGithubRepoAdapter(BASE_CFG);
    const repo = {
      owner: 'oa-test-user',
      name: 'adapter-factory-test',
      url: 'https://github.com/oa-test-user/adapter-factory-test',
      defaultBranch: 'main',
      visibility: 'private' as const,
    };
    await expect(
      adapter.delete(repo, '' as import('@openagentry/core').ConfirmToken),
    ).rejects.toMatchObject({ code: GITHUB_ERROR_CODES.INVALID });
  });
});
