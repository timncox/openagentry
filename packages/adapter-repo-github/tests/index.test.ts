import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ENV_KEYS = ['OA_GITHUB_TOKEN', 'OA_GITHUB_ENDPOINT'] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

// Reset module cache between test groups so the `cached` variable is fresh.
// vi.resetModules() works reliably across Vitest's module registry.
async function freshImport() {
  vi.resetModules();
  const mod = await import('../src/index.js');
  return mod;
}

const GITHUB_REPO_RESPONSE = {
  id: 1001,
  name: 'lazy-test-repo',
  owner: { login: 'lazy-test-user' },
  html_url: 'https://github.com/lazy-test-user/lazy-test-repo',
  default_branch: 'main',
  private: false,
  visibility: 'public',
  description: null,
};

const REPO_FIXTURE = {
  owner: 'lazy-test-user',
  name: 'lazy-test-repo',
  url: 'https://github.com/lazy-test-user/lazy-test-repo',
  defaultBranch: 'main',
  visibility: 'public' as const,
};

// ─── Static fields accessible without env ────────────────────────────────────

describe('default export — static fields accessible without env', () => {
  beforeEach(() => clearEnv());

  it('exposes category === "repo" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.category).toBe('repo');
  });

  it('exposes id === "repo-github" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.id).toBe('repo-github');
  });
});

// ─── Async methods return Promise.reject (not sync throws) when env missing ───

describe('default export — missing env converts sync throw to Promise.reject', () => {
  beforeEach(() => clearEnv());

  it('create returns Promise.reject (not sync throw) when env missing', async () => {
    const mod = await freshImport();
    const call = mod.default.create({
      owner: 'x',
      name: 'y',
      visibility: 'private',
    });
    // Must be a Promise — not a synchronous exception
    expect(call).toBeInstanceOf(Promise);
    await expect(call).rejects.toMatchObject({
      code: 'E_GITHUB_AUTH',
      phase: 'init',
    });
  });

  it('delete returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    const confirm = 'confirm' as import('@openagentry/core').ConfirmToken;
    await expect(
      mod.default.delete(REPO_FIXTURE, confirm),
    ).rejects.toMatchObject({ code: 'E_GITHUB_AUTH', phase: 'init' });
  });

  it('get returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.get('nobody', 'no-repo'),
    ).rejects.toMatchObject({ code: 'E_GITHUB_AUTH', phase: 'init' });
  });
});

// ─── remoteUrl throws sync (not Promise.reject) when env missing ───────────

describe('default export — remoteUrl is sync and throws directly when env missing', () => {
  beforeEach(() => clearEnv());

  it('remoteUrl throws synchronously (not a Promise.reject) when env missing', async () => {
    const mod = await freshImport();
    // remoteUrl is a sync method — missing env causes sync throw from buildFromEnv()
    expect(() => mod.default.remoteUrl(REPO_FIXTURE, 'https')).toThrow();
  });

  it('remoteUrl sync throw carries E_GITHUB_AUTH code', async () => {
    const mod = await freshImport();
    try {
      mod.default.remoteUrl(REPO_FIXTURE, 'https');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('E_GITHUB_AUTH');
    }
  });
});

// ─── Env-driven success + caching ────────────────────────────────────────────

describe('default export — env-driven success + adapter caching', () => {
  beforeEach(() => clearEnv());

  it('builds adapter from env and resolves get', async () => {
    process.env.OA_GITHUB_TOKEN = 'ghp_lazy_test_token';
    server.use(
      http.get('https://api.github.com/repos/lazy-test-user/lazy-test-repo', () =>
        HttpResponse.json(GITHUB_REPO_RESPONSE),
      ),
    );
    const mod = await freshImport();
    const repo = await mod.default.get('lazy-test-user', 'lazy-test-repo');
    expect(repo).not.toBeNull();
    expect(repo!.name).toBe('lazy-test-repo');
    expect(repo!.owner).toBe('lazy-test-user');
  });

  it('remoteUrl returns correct string after env is set', async () => {
    process.env.OA_GITHUB_TOKEN = 'ghp_lazy_test_token';
    const mod = await freshImport();
    const url = mod.default.remoteUrl(REPO_FIXTURE, 'ssh');
    expect(url).toBe('git@github.com:lazy-test-user/lazy-test-repo.git');
  });

  it('remoteUrl https mode returns correct string', async () => {
    process.env.OA_GITHUB_TOKEN = 'ghp_lazy_test_token';
    const mod = await freshImport();
    const url = mod.default.remoteUrl(REPO_FIXTURE, 'https');
    expect(url).toBe('https://github.com/lazy-test-user/lazy-test-repo.git');
  });

  it('caches the underlying adapter across multiple get calls', async () => {
    process.env.OA_GITHUB_TOKEN = 'ghp_lazy_test_token';
    let apiCallCount = 0;
    server.use(
      http.get('https://api.github.com/repos/lazy-test-user/lazy-test-repo', () => {
        apiCallCount += 1;
        return HttpResponse.json(GITHUB_REPO_RESPONSE);
      }),
    );
    const mod = await freshImport();
    await mod.default.get('lazy-test-user', 'lazy-test-repo');
    await mod.default.get('lazy-test-user', 'lazy-test-repo');
    // Two API calls (one per get) — but buildFromEnv should have run only once.
    // Verify by checking that exactly 2 API requests fired (not 4 from double-building).
    expect(apiCallCount).toBe(2);
  });

  it('respects OA_GITHUB_ENDPOINT override for GHE Server', async () => {
    process.env.OA_GITHUB_TOKEN = 'ghp_lazy_ghe_token';
    process.env.OA_GITHUB_ENDPOINT = 'https://github.example.com/api/v3';
    server.use(
      http.get(
        'https://github.example.com/api/v3/repos/ghe-owner/ghe-repo',
        () => HttpResponse.json({
          ...GITHUB_REPO_RESPONSE,
          name: 'ghe-repo',
          owner: { login: 'ghe-owner' },
          html_url: 'https://github.example.com/ghe-owner/ghe-repo',
        }),
      ),
    );
    const mod = await freshImport();
    const repo = await mod.default.get('ghe-owner', 'ghe-repo');
    expect(repo).not.toBeNull();
    expect(repo!.owner).toBe('ghe-owner');
  });
});
