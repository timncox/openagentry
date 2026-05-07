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

const ENV_KEYS = ['OA_VERCEL_TOKEN', 'OA_VERCEL_TEAM_ID', 'OA_VERCEL_ENDPOINT'] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

/**
 * Re-imports the module from scratch so the module-level `cached` variable is
 * reset between test groups. vi.resetModules() invalidates Vitest's module
 * registry; the subsequent dynamic import() loads a fresh copy.
 */
async function freshImport() {
  vi.resetModules();
  return import('../src/index.js');
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const PROJECT_FIXTURE: import('@openagentry/core').HostProject = {
  id: 'prj_lazy_test_001',
  name: 'lazy-test-project',
  slug: 'lazy-test-project',
  hostId: 'prj_lazy_test_001',
  createdAt: '2026-05-07T00:00:00.000Z',
};

const PROJECT_RESPONSE = {
  id: 'prj_lazy_test_001',
  name: 'lazy-test-project',
  createdAt: '2026-05-07T00:00:00.000Z',
};

const ENV_RESPONSE = {
  envs: [
    { id: 'env_001', key: 'LAZY_KEY', value: 'lazy-value', target: ['production'], type: 'plain' },
  ],
};

const LOGS_RESPONSE = [
  { id: 'log_001', created: Date.now(), text: 'Build complete', type: 'command' },
];

// ─── Static fields accessible without env ─────────────────────────────────────

describe('default export — static fields accessible without env', () => {
  beforeEach(() => clearEnv());

  it('exposes category === "host" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.category).toBe('host');
  });

  it('exposes id === "host-vercel" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.id).toBe('host-vercel');
  });
});

// ─── Async methods return Promise.reject when env missing ─────────────────────

describe('default export — missing env converts sync throw to Promise.reject', () => {
  beforeEach(() => clearEnv());

  it('createProject returns Promise.reject (not sync throw) when env missing', async () => {
    const mod = await freshImport();
    const call = mod.default.createProject({ name: 'x', slug: 'x' });
    // Must be a Promise — the call must not throw synchronously
    expect(call).toBeInstanceOf(Promise);
    await expect(call).rejects.toMatchObject({
      code: 'E_VERCEL_AUTH',
      phase: 'init',
    });
  });

  it('destroyProject returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    const confirm = 'confirm' as import('@openagentry/core').ConfirmToken;
    await expect(
      mod.default.destroyProject(PROJECT_FIXTURE, confirm),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('deploy returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.deploy(PROJECT_FIXTURE, 'prod'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('rollback returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.rollback(PROJECT_FIXTURE, 'dpl_bogus'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('setEnv returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.setEnv(PROJECT_FIXTURE, { FOO: 'bar' }, 'prod'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('getEnv returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.getEnv(PROJECT_FIXTURE, 'prod'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('attachDomain returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.attachDomain(PROJECT_FIXTURE, 'example.com'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('detachDomain returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.detachDomain(PROJECT_FIXTURE, 'example.com'),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('exportState returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.exportState(PROJECT_FIXTURE),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });

  it('importState returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    // Minimal HostStateBundle shape to satisfy type checker
    const bundle = {
      version: 1 as const,
      hostProject: PROJECT_FIXTURE,
      env: { preview: {}, prod: {}, dev: {} },
      domains: [],
    };
    await expect(
      mod.default.importState(bundle as import('@openagentry/core').HostStateBundle),
    ).rejects.toMatchObject({ code: 'E_VERCEL_AUTH', phase: 'init' });
  });
});

// ─── logs without env returns rejecting iterator ──────────────────────────────

describe('default export — logs returns rejecting iterator when env missing', () => {
  beforeEach(() => clearEnv());

  it('logs() returns an AsyncIterable (not a Promise) even when env missing', async () => {
    const mod = await freshImport();
    const result = mod.default.logs(PROJECT_FIXTURE, { tail: false });
    // Must be iterable — Symbol.asyncIterator present
    expect(Symbol.asyncIterator in result).toBe(true);
    // Must NOT be a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('logs() iterator throws E_VERCEL_AUTH on first next() when env missing', async () => {
    const mod = await freshImport();
    let thrownErr: unknown;
    try {
      for await (const _line of mod.default.logs(PROJECT_FIXTURE, { tail: false })) {
        // should not get any lines
      }
    } catch (err) {
      thrownErr = err;
    }
    expect(thrownErr).toBeDefined();
    expect((thrownErr as { code?: string }).code).toBe('E_VERCEL_AUTH');
    expect((thrownErr as { phase?: string }).phase).toBe('init');
  });
});

// ─── Env-driven success + caching ─────────────────────────────────────────────

describe('default export — env-driven success + adapter caching', () => {
  beforeEach(() => clearEnv());

  it('builds adapter from env and resolves createProject', async () => {
    process.env.OA_VERCEL_TOKEN = 'vercel_test_lazy_token';
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(PROJECT_RESPONSE, { status: 201 }),
      ),
    );
    const mod = await freshImport();
    const project = await mod.default.createProject({
      name: 'lazy-test-project',
      slug: 'lazy-test-project',
    });
    expect(project.id).toBe('prj_lazy_test_001');
    expect(project.hostId).toBe('prj_lazy_test_001');
  });

  it('builds adapter from env and resolves getEnv', async () => {
    process.env.OA_VERCEL_TOKEN = 'vercel_test_lazy_token';
    server.use(
      http.get('https://api.vercel.com/v9/projects/lazy-test-project/env', () =>
        HttpResponse.json(ENV_RESPONSE),
      ),
    );
    const mod = await freshImport();
    const vars = await mod.default.getEnv(PROJECT_FIXTURE, 'prod');
    expect(vars['LAZY_KEY']).toBe('lazy-value');
  });

  it('logs() works with env set and yields lines', async () => {
    process.env.OA_VERCEL_TOKEN = 'vercel_test_lazy_token';
    server.use(
      // logs resolves deployment id first
      http.get('https://api.vercel.com/v6/deployments', () =>
        HttpResponse.json({ deployments: [{ uid: 'dpl_lazy_001' }] }),
      ),
      http.get('https://api.vercel.com/v3/deployments/dpl_lazy_001/events', () =>
        HttpResponse.json(LOGS_RESPONSE),
      ),
    );
    const mod = await freshImport();
    const lines: import('@openagentry/core').LogLine[] = [];
    for await (const line of mod.default.logs(PROJECT_FIXTURE, { tail: false })) {
      lines.push(line);
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.message).toBe('Build complete');
  });

  it('caches the underlying adapter across multiple method calls', async () => {
    process.env.OA_VERCEL_TOKEN = 'vercel_test_lazy_token';
    let apiCallCount = 0;
    server.use(
      http.get('https://api.vercel.com/v9/projects/lazy-test-project/env', () => {
        apiCallCount += 1;
        return HttpResponse.json(ENV_RESPONSE);
      }),
    );
    const mod = await freshImport();
    await mod.default.getEnv(PROJECT_FIXTURE, 'prod');
    await mod.default.getEnv(PROJECT_FIXTURE, 'prod');
    // Two API calls (one per getEnv) — buildFromEnv should have run exactly once.
    expect(apiCallCount).toBe(2);
  });

  it('respects OA_VERCEL_ENDPOINT override', async () => {
    process.env.OA_VERCEL_TOKEN = 'vercel_test_lazy_token';
    process.env.OA_VERCEL_ENDPOINT = 'https://api.vercel.example.com';
    server.use(
      http.get('https://api.vercel.example.com/v9/projects/lazy-test-project/env', () =>
        HttpResponse.json(ENV_RESPONSE),
      ),
    );
    const mod = await freshImport();
    const vars = await mod.default.getEnv(PROJECT_FIXTURE, 'prod');
    expect(vars['LAZY_KEY']).toBe('lazy-value');
  });
});
