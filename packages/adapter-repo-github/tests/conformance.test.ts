import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

/**
 * Default MSW handler: any GET request to api.github.com returns a 401 JSON
 * body. This is hermetic — no real network call is made.
 *
 * The conformance suite's repo/structured-errors check calls:
 *   adapter.get('not-a-real-owner-99', 'not-a-real-repo-99')
 *
 * With a dummy OA_GITHUB_TOKEN set below, the adapter builds successfully.
 * githubFetch hits api.github.com/repos/... and MSW returns 401 →
 * httpToGithubError(401, ...) → AgentryError({ code: 'E_GITHUB_AUTH', phase: 'read' }).
 *
 * E_GITHUB_AUTH starts with 'E_' and phase 'read' ∈ REPO_PHASES →
 * repo/structured-errors check PASSES by the structured-error path.
 *
 * The opt-in repo/create-delete-roundtrip check requires
 * OA_REPO_CONFORMANCE_TEST_OWNER — we leave it unset so the check is SKIPPED.
 */
const server = setupServer(
  http.get('https://api.github.com/*', () =>
    HttpResponse.json(
      { message: 'Bad credentials', documentation_url: 'https://docs.github.com' },
      { status: 401 },
    ),
  ),
);

beforeAll(() => {
  // Provide a dummy token so the lazy default export can construct an adapter.
  // The token is invalid — all requests are intercepted by MSW above.
  process.env.OA_GITHUB_TOKEN = 'ghp_dummy_conformance_token_000000000000';
  // Ensure the opt-in roundtrip check does NOT run.
  delete process.env.OA_REPO_CONFORMANCE_TEST_OWNER;
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => server.resetHandlers());

afterAll(() => {
  server.close();
  delete process.env.OA_GITHUB_TOKEN;
});

describe('GitHub repo adapter conformance', () => {
  it('passes universal checks + repo/structured-errors; create-delete-roundtrip is absent', async () => {
    const result = await runSuite({
      target: packageDir,
      category: 'repo',
    });

    const failures = result.checks.filter((c) => c.status === 'fail');
    if (failures.length > 0) {
      console.error('Conformance failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);

    // Must include all 4 universal checks + repo/structured-errors = at least 5.
    expect(result.checks.length).toBeGreaterThanOrEqual(5);

    const ids = result.checks.map((c) => c.id);

    // Universal checks always present:
    expect(ids).toContain('manifest/valid');
    expect(ids).toContain('manifest/protocol-compatible');
    expect(ids).toContain('ai-friendly/flags');
    expect(ids).toContain('docs/llm-md');

    // Always-on repo functional check:
    expect(ids).toContain('repo/structured-errors');

    // Opt-in check must NOT be present (OA_REPO_CONFORMANCE_TEST_OWNER unset):
    expect(ids).not.toContain('repo/create-delete-roundtrip');
  });
});
