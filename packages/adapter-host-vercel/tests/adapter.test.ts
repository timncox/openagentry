import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createVercelHostAdapter } from '../src/adapter.js';
import { VERCEL_ERROR_CODES } from '../src/errors.js';

// ─── Canned JSON responses ────────────────────────────────────────────────────

const PROJECT_RESPONSE = {
  id: 'prj_factory_test_001',
  name: 'factory-test-project',
  createdAt: '2026-05-07T00:00:00.000Z',
};

const DEPLOYMENT_RESPONSE = {
  id: 'dpl_factory_test_001',
  uid: 'dpl_factory_test_001',
  url: 'factory-test-project-abc.vercel.app',
  readyState: 'READY',
  target: 'production',
  createdAt: '2026-05-07T00:00:00.000Z',
};

const ENV_RESPONSE = {
  envs: [
    {
      id: 'env_001',
      key: 'FACTORY_KEY',
      value: 'factory-value',
      target: ['production'],
      type: 'plain',
    },
  ],
};

const DOMAINS_RESPONSE = {
  domains: [{ name: 'factory-test.example.com' }],
  pagination: { count: 1, next: null },
};

const DOMAIN_ATTACH_RESPONSE = {
  name: 'factory-test.example.com',
  verified: true,
  verification: [],
};

const PROMOTE_RESPONSE = {
  id: 'dpl_factory_test_001',
  uid: 'dpl_factory_test_001',
  url: 'factory-test-project-abc.vercel.app',
  readyState: 'READY',
  target: 'production',
  createdAt: '2026-05-07T00:00:00.000Z',
};

const LOGS_RESPONSE = [
  { id: 'log_001', created: '2026-05-07T00:00:00.000Z', text: 'Build started', type: 'command' },
];

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Shared valid config ───────────────────────────────────────────────────────

const VALID_CFG = { token: 'vercel_test_token_factory' };

// ─── Factory shape ────────────────────────────────────────────────────────────

describe('createVercelHostAdapter — factory shape', () => {
  it('returns a frozen object', () => {
    const adapter = createVercelHostAdapter(VALID_CFG);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('exposes category === "host"', () => {
    const adapter = createVercelHostAdapter(VALID_CFG);
    expect(adapter.category).toBe('host');
  });

  it('exposes id === "host-vercel"', () => {
    const adapter = createVercelHostAdapter(VALID_CFG);
    expect(adapter.id).toBe('host-vercel');
  });

  it('exposes all 11 HostAdapter methods', () => {
    const adapter = createVercelHostAdapter(VALID_CFG);
    const methods = [
      'createProject',
      'destroyProject',
      'deploy',
      'rollback',
      'setEnv',
      'getEnv',
      'attachDomain',
      'detachDomain',
      'logs',
      'exportState',
      'importState',
    ] as const;
    for (const m of methods) {
      expect(typeof adapter[m], `${m} must be a function`).toBe('function');
    }
  });
});

// ─── Config validation guard ──────────────────────────────────────────────────

describe('createVercelHostAdapter — config validation', () => {
  it('throws synchronously when token is missing', () => {
    expect(() => createVercelHostAdapter({} as never)).toThrow();
  });

  it('thrown error carries code E_VERCEL_SCHEMA', () => {
    try {
      createVercelHostAdapter({} as never);
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe(VERCEL_ERROR_CODES.SCHEMA);
    }
  });

  it('throws when token is empty string', () => {
    expect(() => createVercelHostAdapter({ token: '' })).toThrow();
  });

  it('throws when endpoint is not a valid URL', () => {
    expect(() =>
      createVercelHostAdapter({ token: 'valid_token', endpoint: 'not-a-url' }),
    ).toThrow();
  });

  it('accepts valid token with optional teamId', () => {
    expect(() =>
      createVercelHostAdapter({ token: 'valid_token', teamId: 'team_abc123' }),
    ).not.toThrow();
  });

  it('accepts valid token with optional endpoint override', () => {
    expect(() =>
      createVercelHostAdapter({
        token: 'valid_token',
        endpoint: 'https://api.vercel.example.com',
      }),
    ).not.toThrow();
  });
});

// ─── logs returns AsyncIterable ───────────────────────────────────────────────

describe('createVercelHostAdapter — logs returns AsyncIterable', () => {
  const PROJECT: import('@openagentry/core').HostProject = {
    id: 'prj_factory_test_001',
    name: 'factory-test-project',
    slug: 'factory-test-project',
    hostId: 'prj_factory_test_001',
    createdAt: '2026-05-07T00:00:00.000Z',
  };

  it('logs() returns an object with Symbol.asyncIterator', () => {
    // logs returns AsyncIterable synchronously — no HTTP call needed at construction
    const adapter = createVercelHostAdapter(VALID_CFG);
    const result = adapter.logs(PROJECT, { tail: false });
    expect(Symbol.asyncIterator in result).toBe(true);
  });

  it('logs() is NOT a Promise', () => {
    // logs returns AsyncIterable synchronously — no HTTP call needed at construction
    const adapter = createVercelHostAdapter(VALID_CFG);
    const result = adapter.logs(PROJECT, { tail: false });
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('logs() AsyncIterable yields LogLine entries', async () => {
    server.use(
      // logs op resolves the latest deployment id first via GET /v6/deployments?projectId=...&limit=1
      http.get('https://api.vercel.com/v6/deployments', () =>
        HttpResponse.json({
          deployments: [{ uid: 'dpl_factory_test_001', url: 'factory-test-project-abc.vercel.app' }],
        }),
      ),
      // then fetches events for that deployment
      http.get('https://api.vercel.com/v3/deployments/dpl_factory_test_001/events', () =>
        HttpResponse.json(LOGS_RESPONSE),
      ),
    );
    const adapter = createVercelHostAdapter(VALID_CFG);
    const lines: import('@openagentry/core').LogLine[] = [];
    for await (const line of adapter.logs(PROJECT, { tail: false })) {
      lines.push(line);
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(typeof lines[0]!.message).toBe('string');
  });
});

// ─── Method delegation smoke tests ────────────────────────────────────────────

describe('createVercelHostAdapter — method delegation', () => {
  it('createProject delegates to projects.ts and returns HostProject', async () => {
    server.use(
      http.post('https://api.vercel.com/v11/projects', () =>
        HttpResponse.json(PROJECT_RESPONSE, { status: 201 }),
      ),
    );
    const adapter = createVercelHostAdapter(VALID_CFG);
    const project = await adapter.createProject({
      name: 'factory-test-project',
      slug: 'factory-test-project',
    });
    expect(project.id).toBe('prj_factory_test_001');
    expect(project.hostId).toBe('prj_factory_test_001');
    expect(project.name).toBe('factory-test-project');
  });

  it('destroyProject delegates to projects.ts and resolves', async () => {
    // destroyProject uses p.slug in the URL path
    server.use(
      http.delete('https://api.vercel.com/v9/projects/factory-test-project', () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    const adapter = createVercelHostAdapter(VALID_CFG);
    const project: import('@openagentry/core').HostProject = {
      id: 'prj_factory_test_001',
      name: 'factory-test-project',
      slug: 'factory-test-project',
      hostId: 'prj_factory_test_001',
      createdAt: '2026-05-07T00:00:00.000Z',
    };
    await expect(
      adapter.destroyProject(
        project,
        'confirm-delete' as import('@openagentry/core').ConfirmToken,
      ),
    ).resolves.toBeUndefined();
  });

  it('getEnv delegates to env.ts and returns record', async () => {
    // getEnv uses p.slug in the URL path
    server.use(
      http.get('https://api.vercel.com/v9/projects/factory-test-project/env', () =>
        HttpResponse.json(ENV_RESPONSE),
      ),
    );
    const adapter = createVercelHostAdapter(VALID_CFG);
    const project: import('@openagentry/core').HostProject = {
      id: 'prj_factory_test_001',
      name: 'factory-test-project',
      slug: 'factory-test-project',
      hostId: 'prj_factory_test_001',
      createdAt: '2026-05-07T00:00:00.000Z',
    };
    const env = await adapter.getEnv(project, 'prod');
    expect(env['FACTORY_KEY']).toBe('factory-value');
  });

  it('attachDomain delegates to domains.ts and returns DomainAttachment', async () => {
    // attachDomain uses p.slug in the URL path
    server.use(
      http.post('https://api.vercel.com/v10/projects/factory-test-project/domains', () =>
        HttpResponse.json(DOMAIN_ATTACH_RESPONSE, { status: 200 }),
      ),
    );
    const adapter = createVercelHostAdapter(VALID_CFG);
    const project: import('@openagentry/core').HostProject = {
      id: 'prj_factory_test_001',
      name: 'factory-test-project',
      slug: 'factory-test-project',
      hostId: 'prj_factory_test_001',
      createdAt: '2026-05-07T00:00:00.000Z',
    };
    const attachment = await adapter.attachDomain(project, 'factory-test.example.com');
    expect(attachment.domain).toBe('factory-test.example.com');
    // Vercel verified: true → adapter status: 'active'
    expect(attachment.status).toBe('active');
  });
});
