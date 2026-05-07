import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

// ─── In-memory state shared across MSW handlers ────────────────────────────────
//
// The host suite creates a project then references it by slug across subsequent
// calls. We track the project name chosen by the suite so every handler can
// reference it. Env vars written via setEnv are also tracked so the getEnv
// round-trip check can read them back.

let capturedSlug = 'conformance-probe'; // fallback; overwritten by POST /projects handler
const storedEnv: Record<string, Record<string, string>> = {
  preview: {},
  production: {},
  development: {},
};

// Track created env var IDs so PATCH can reference them.
const envIdMap: Record<string, string> = {}; // `${bucket}:${key}` → id

function targetToStore(target: string[]): string {
  // Use the first element of the target array to identify the env bucket.
  const first = target[0] ?? 'preview';
  if (first === 'production') return 'production';
  if (first === 'development') return 'development';
  return 'preview';
}

// ─── MSW handlers ─────────────────────────────────────────────────────────────

const handlers = [
  // POST /v11/projects — createProject
  http.post('https://api.vercel.com/v11/projects', async ({ request }) => {
    const body = await request.json() as { name?: string };
    const name = body?.name ?? 'conformance-probe';
    // Capture the slug the suite chose so later handlers can route on it.
    capturedSlug = name;
    return HttpResponse.json({
      id: `prj_conformance_${name}`,
      name,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // DELETE /v9/projects/:slug — destroyProject
  http.delete('https://api.vercel.com/v9/projects/:slug', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // GET /v9/projects/:slug/env — getEnv + exportState reads
  // Returns whatever has been stored via setEnv, filtered by vercel target.
  // getEnv op always uses ?decrypt=true; exportState calls getEnv for each env.
  http.get('https://api.vercel.com/v9/projects/:slug/env', ({ request }) => {
    const url = new URL(request.url);
    const targetParam = url.searchParams.get('target');

    // Build the combined list across all targets or filtered by target.
    const allEnvs: Array<{
      id: string;
      key: string;
      value: string;
      target: string[];
      type: string;
    }> = [];

    for (const [bucket, vars] of Object.entries(storedEnv)) {
      if (targetParam !== null && bucket !== targetParam) continue;
      for (const [key, value] of Object.entries(vars)) {
        allEnvs.push({
          id: envIdMap[`${bucket}:${key}`] ?? `env_${bucket}_${key}`,
          key,
          value,
          target: [bucket],
          type: 'plain',
        });
      }
    }

    return HttpResponse.json({ envs: allEnvs });
  }),

  // POST /v10/projects/:slug/env — setEnv create (new var)
  http.post('https://api.vercel.com/v10/projects/:slug/env', async ({ request }) => {
    const body = await request.json() as {
      key?: string;
      value?: string;
      target?: string[];
      type?: string;
    };
    const key = body?.key ?? 'UNKNOWN';
    const value = body?.value ?? '';
    const targets = body?.target ?? ['preview'];
    const bucket = targetToStore(targets);
    const id = `env_created_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    storedEnv[bucket]![key] = value;
    envIdMap[`${bucket}:${key}`] = id;
    return HttpResponse.json({
      id,
      key,
      value,
      target: targets,
      type: 'plain',
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // PATCH /v10/projects/:slug/env/:id — setEnv update (existing var)
  http.patch(
    'https://api.vercel.com/v10/projects/:slug/env/:id',
    async ({ params, request }) => {
      const body = await request.json() as {
        key?: string;
        value?: string;
        target?: string[];
      };
      const key = body?.key ?? 'UNKNOWN';
      const value = body?.value ?? '';
      const targets = body?.target ?? ['preview'];
      const bucket = targetToStore(targets);
      storedEnv[bucket]![key] = value;
      return HttpResponse.json({
        id: params['id'],
        key,
        value,
        target: targets,
        type: 'plain',
        updatedAt: new Date().toISOString(),
      });
    },
  ),

  // GET /v9/projects/:slug/domains — exportState domain list
  http.get('https://api.vercel.com/v9/projects/:slug/domains', () =>
    HttpResponse.json({
      domains: [],
      pagination: { count: 0, next: null },
    }),
  ),

  // POST /v10/projects/:slug/domains — importState domain reattach
  http.post('https://api.vercel.com/v10/projects/:slug/domains', async ({ request }) => {
    const body = await request.json() as { name?: string };
    const name = body?.name ?? 'unknown.example.com';
    return HttpResponse.json({
      name,
      verified: true,
      verification: [],
    });
  }),

  // POST /v10/projects/:slug/promote/:deplId — rollback
  // The host/structured-errors check calls rollback with 'definitely-not-a-real-deployment-id'.
  // Return 404 so the adapter maps this to E_VERCEL_NOT_FOUND (an AgentryError).
  http.post(
    'https://api.vercel.com/v10/projects/:slug/promote/:deplId',
    () => {
      return HttpResponse.json(
        { error: { code: 'not_found', message: 'Deployment not found' } },
        { status: 404 },
      );
    },
  ),
];

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => {
  // Seed env so the lazy default adapter builds from env vars.
  // The token is intentionally the string 'dummy_for_conformance' — MSW
  // intercepts all requests before they reach Vercel so the token value is
  // never validated by the real API.
  process.env['OA_VERCEL_TOKEN'] = 'dummy_for_conformance';

  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // Reset MSW handlers to the defaults after each test.
  server.resetHandlers();

  // Clear in-memory state between runs.
  for (const bucket of Object.keys(storedEnv)) {
    storedEnv[bucket] = {};
  }
  for (const key of Object.keys(envIdMap)) {
    delete envIdMap[key];
  }
  capturedSlug = 'conformance-probe';
});

afterAll(() => {
  server.close();
  delete process.env['OA_VERCEL_TOKEN'];
});

// ─── Conformance test ─────────────────────────────────────────────────────────

describe('Vercel host adapter conformance', () => {
  it(
    'passes all universal checks + all 5 host functional checks',
    async () => {
      const result = await runSuite({
        target: packageDir,
        category: 'host',
      });

      const failures = result.checks.filter((c) => c.status === 'fail');
      if (failures.length > 0) {
        console.error(
          'Conformance failures:\n',
          JSON.stringify(failures, null, 2),
        );
      }
      expect(failures).toEqual([]);

      // Expect at least: 3 universal + 5 host functional = 8 checks minimum.
      expect(result.checks.length).toBeGreaterThanOrEqual(8);

      const ids = result.checks.map((c) => c.id);

      // Universal checks:
      expect(ids).toContain('manifest/valid');
      expect(ids).toContain('manifest/protocol-compatible');
      expect(ids).toContain('ai-friendly/flags');
      expect(ids).toContain('docs/llm-md');

      // Host functional checks:
      expect(ids).toContain('host/createProject');
      expect(ids).toContain('host/setEnv-idempotent');
      expect(ids).toContain('host/getEnv-roundtrip');
      expect(ids).toContain('host/exportState-importState');
      expect(ids).toContain('host/structured-errors');
    },
    60_000,
  );
});
