import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { setEnv, getEnv } from '../../src/ops/env.js';
import type { VercelHostConfig } from '../../src/config.js';
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

function envListResponse(envs: Array<{
  id: string;
  key: string;
  value: string;
  type?: string;
  target: string[];
}>) {
  return HttpResponse.json({
    envs: envs.map((e) => ({ type: 'encrypted', ...e })),
  });
}

// ---------------------------------------------------------------------------
// setEnv — new var → POST
// ---------------------------------------------------------------------------

describe('setEnv — new var → POST', () => {
  it('POSTs a new env var when key does not exist in Vercel', async () => {
    const postCalls: unknown[] = [];
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([]),
      ),
      http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
        postCalls.push(await request.json());
        return HttpResponse.json({ id: 'env_new1', key: 'MY_VAR', value: 'hello' });
      }),
    );
    await setEnv(cfg, stubProject, { MY_VAR: 'hello' }, 'preview');
    expect(postCalls).toHaveLength(1);
    expect((postCalls[0] as Record<string, unknown>)['key']).toBe('MY_VAR');
    expect((postCalls[0] as Record<string, unknown>)['value']).toBe('hello');
  });

  it('POSTs with the correct target array for the given env', async () => {
    const postCalls: unknown[] = [];
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([]),
      ),
      http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
        postCalls.push(await request.json());
        return HttpResponse.json({ id: 'env_new2' });
      }),
    );
    await setEnv(cfg, stubProject, { MY_VAR: 'hello' }, 'prod');
    const body = postCalls[0] as Record<string, unknown>;
    expect(body['target']).toEqual(['production']);
  });
});

// ---------------------------------------------------------------------------
// setEnv — existing var, same value → no HTTP call
// ---------------------------------------------------------------------------

describe('setEnv — existing var same value → skip', () => {
  it('makes no PATCH or POST when key exists with the same value', async () => {
    const patchCalls: unknown[] = [];
    const postCalls: unknown[] = [];
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'env_existing', key: 'MY_VAR', value: 'hello', target: ['preview'] },
        ]),
      ),
      http.patch('https://api.vercel.com/v10/projects/my-app/env/env_existing', async ({ request }) => {
        patchCalls.push(await request.json());
        return HttpResponse.json({});
      }),
      http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
        postCalls.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    await setEnv(cfg, stubProject, { MY_VAR: 'hello' }, 'preview');
    expect(patchCalls).toHaveLength(0);
    expect(postCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setEnv — existing var, different value → PATCH
// ---------------------------------------------------------------------------

describe('setEnv — existing var different value → PATCH', () => {
  it('PATCHes the env var when key exists with a different value', async () => {
    const patchCalls: unknown[] = [];
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'env_existing', key: 'MY_VAR', value: 'old-value', target: ['preview'] },
        ]),
      ),
      http.patch('https://api.vercel.com/v10/projects/my-app/env/env_existing', async ({ request }) => {
        patchCalls.push(await request.json());
        return HttpResponse.json({ id: 'env_existing', key: 'MY_VAR', value: 'new-value' });
      }),
    );
    await setEnv(cfg, stubProject, { MY_VAR: 'new-value' }, 'preview');
    expect(patchCalls).toHaveLength(1);
    expect((patchCalls[0] as Record<string, unknown>)['value']).toBe('new-value');
  });

  it('uses the var id from the GET response in the PATCH URL', async () => {
    let patchUrl: string | undefined;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'env_specific_id', key: 'MY_VAR', value: 'old', target: ['preview'] },
        ]),
      ),
      http.patch('https://api.vercel.com/v10/projects/my-app/env/env_specific_id', ({ request }) => {
        patchUrl = request.url;
        return HttpResponse.json({});
      }),
    );
    await setEnv(cfg, stubProject, { MY_VAR: 'new' }, 'preview');
    expect(patchUrl).toContain('/v10/projects/my-app/env/env_specific_id');
  });
});

// ---------------------------------------------------------------------------
// setEnv — idempotent (second call is a no-op)
// ---------------------------------------------------------------------------

describe('setEnv — idempotent second call', () => {
  it('second call with same vars makes no POST or PATCH calls', async () => {
    const postCalls: unknown[] = [];
    const patchCalls: unknown[] = [];

    // First call: var is absent → POST.
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([]),
      ),
      http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
        postCalls.push(await request.json());
        return HttpResponse.json({ id: 'env_created', key: 'STABLE_VAR', value: 'stable' });
      }),
    );
    await setEnv(cfg, stubProject, { STABLE_VAR: 'stable' }, 'preview');
    expect(postCalls).toHaveLength(1);

    // Second call: var now exists with the same value → no HTTP mutation calls.
    server.resetHandlers();
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'env_created', key: 'STABLE_VAR', value: 'stable', target: ['preview'] },
        ]),
      ),
      http.patch('https://api.vercel.com/v10/projects/my-app/env/env_created', async ({ request }) => {
        patchCalls.push(await request.json());
        return HttpResponse.json({});
      }),
      http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
        postCalls.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    await setEnv(cfg, stubProject, { STABLE_VAR: 'stable' }, 'preview');
    expect(postCalls).toHaveLength(1); // unchanged from first call
    expect(patchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setEnv — env target mapping
// ---------------------------------------------------------------------------

describe('setEnv — env target mapping', () => {
  it.each([
    ['prod', 'production'],
    ['preview', 'preview'],
    ['dev', 'development'],
  ] as [string, string][])(
    'env=%s sends target=[%s] in POST body',
    async (oa_env, vercel_target) => {
      const postCalls: unknown[] = [];
      server.use(
        http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
          envListResponse([]),
        ),
        http.post('https://api.vercel.com/v10/projects/my-app/env', async ({ request }) => {
          postCalls.push(await request.json());
          return HttpResponse.json({ id: 'env_new' });
        }),
      );
      await setEnv(
        cfg,
        stubProject,
        { FOO: 'bar' },
        oa_env as 'prod' | 'preview' | 'dev',
      );
      const body = postCalls[0] as Record<string, unknown>;
      expect(body['target']).toEqual([vercel_target]);
    },
  );
});

// ---------------------------------------------------------------------------
// getEnv — filter by target array
// ---------------------------------------------------------------------------

describe('getEnv — filter by target array', () => {
  it('returns only vars whose target includes "production" for prod env', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'e1', key: 'PROD_VAR', value: 'prod-value', target: ['production'] },
          { id: 'e2', key: 'PREVIEW_VAR', value: 'preview-value', target: ['preview'] },
          { id: 'e3', key: 'BOTH_VAR', value: 'both-value', target: ['production', 'preview'] },
        ]),
      ),
    );
    const result = await getEnv(cfg, stubProject, 'prod');
    expect(result).toEqual({ PROD_VAR: 'prod-value', BOTH_VAR: 'both-value' });
    expect('PREVIEW_VAR' in result).toBe(false);
  });

  it('returns only vars whose target includes "preview" for preview env', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'e1', key: 'PROD_VAR', value: 'prod-value', target: ['production'] },
          { id: 'e2', key: 'PREVIEW_VAR', value: 'preview-value', target: ['preview'] },
        ]),
      ),
    );
    const result = await getEnv(cfg, stubProject, 'preview');
    expect(result).toEqual({ PREVIEW_VAR: 'preview-value' });
    expect('PROD_VAR' in result).toBe(false);
  });

  it('returns only vars whose target includes "development" for dev env', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'e1', key: 'DEV_VAR', value: 'dev-value', target: ['development'] },
          { id: 'e2', key: 'PROD_VAR', value: 'prod-value', target: ['production'] },
        ]),
      ),
    );
    const result = await getEnv(cfg, stubProject, 'dev');
    expect(result).toEqual({ DEV_VAR: 'dev-value' });
  });

  it('returns an empty record when no vars match the target', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([
          { id: 'e1', key: 'PROD_VAR', value: 'prod-value', target: ['production'] },
        ]),
      ),
    );
    const result = await getEnv(cfg, stubProject, 'dev');
    expect(result).toEqual({});
  });

  it('returns an empty record when project has no env vars at all', async () => {
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', () =>
        envListResponse([]),
      ),
    );
    const result = await getEnv(cfg, stubProject, 'prod');
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getEnv — uses decrypt=true query param
// ---------------------------------------------------------------------------

describe('getEnv — decrypt=true query param', () => {
  it('includes decrypt=true in the GET request URL', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get('https://api.vercel.com/v9/projects/my-app/env', ({ request }) => {
        capturedUrl = request.url;
        return envListResponse([]);
      }),
    );
    await getEnv(cfg, stubProject, 'prod');
    expect(capturedUrl).toContain('decrypt=true');
  });
});
