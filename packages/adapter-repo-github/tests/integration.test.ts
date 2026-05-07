import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createGithubRepoAdapter } from '../src/adapter.js';

/**
 * Integration tests against the real GitHub API.
 *
 * Required env vars (BOTH must be set for any test to run):
 *   OA_GITHUB_INTEGRATION_TEST_TOKEN  — a real PAT with `repo` scope
 *   OA_GITHUB_INTEGRATION_TEST_OWNER  — GitHub user or org login that will own
 *                                       any created repos (must match the token)
 *
 * Tests are hermetically gated: if either var is absent/empty the entire suite
 * is skipped and normal `pnpm test` never touches the network.
 *
 * Run with:
 *   OA_GITHUB_INTEGRATION_TEST_TOKEN=ghp_xxx \
 *   OA_GITHUB_INTEGRATION_TEST_OWNER=my-login \
 *     pnpm --filter @openagentry/adapter-repo-github test tests/integration.test.ts
 */

const TOKEN = process.env.OA_GITHUB_INTEGRATION_TEST_TOKEN;
const OWNER = process.env.OA_GITHUB_INTEGRATION_TEST_OWNER;

const enabled =
  typeof TOKEN === 'string' && TOKEN.length > 0 &&
  typeof OWNER === 'string' && OWNER.length > 0;

describe.skipIf(!enabled)('GitHub real-API integration', () => {
  /**
   * Test 1: Read a well-known public repo. octocat/Hello-World has existed since
   * 2011 and its default branch is 'master'. This exercises get() end-to-end
   * against the live API with a valid token.
   */
  it('get("octocat", "Hello-World") returns Repository with defaultBranch === "master"', async () => {
    const adapter = createGithubRepoAdapter({ token: TOKEN! });
    const repo = await adapter.get('octocat', 'Hello-World');

    expect(repo).not.toBeNull();
    expect(repo!.owner).toBe('octocat');
    expect(repo!.name).toBe('Hello-World');
    expect(repo!.defaultBranch).toBe('master');
    expect(typeof repo!.url).toBe('string');
    expect(repo!.url.length).toBeGreaterThan(0);
  }, 30_000);

  /**
   * Test 2: Auth failure. A bogus token must cause get() to throw an AgentryError
   * with code E_GITHUB_AUTH or E_GITHUB_PERMISSION (both are acceptable — GitHub
   * returns 401 for bad tokens but some GHE configs return 403).
   */
  it('bogus token: get("octocat", "Hello-World") throws AUTH or PERMISSION error', async () => {
    const adapter = createGithubRepoAdapter({ token: 'ghp_this_is_not_a_real_token_000000' });
    await expect(adapter.get('octocat', 'Hello-World')).rejects.toMatchObject({
      code: expect.stringMatching(/^E_GITHUB_(AUTH|PERMISSION)$/),
    });
  }, 30_000);

  /**
   * Test 3: Full create → get → delete → get-null roundtrip against
   * OA_GITHUB_INTEGRATION_TEST_OWNER. The repo name is randomised to avoid
   * collisions across parallel runs. try/finally ensures best-effort cleanup
   * even when an assertion fails mid-roundtrip.
   */
  it('create → get → delete → get-null roundtrip on a randomly-named repo', async () => {
    const adapter = createGithubRepoAdapter({ token: TOKEN! });
    const repoName = `oa-conformance-${randomUUID()}`;

    let created: Awaited<ReturnType<typeof adapter.create>> | undefined;
    try {
      // (a) Create
      created = await adapter.create({
        owner: OWNER!,
        name: repoName,
        visibility: 'private',
        description: 'OpenAgentry integration test — safe to delete',
      });
      expect(created.owner).toBe(OWNER!);
      expect(created.name).toBe(repoName);
      expect(created.visibility).toBe('private');
      expect(typeof created.defaultBranch).toBe('string');
      expect(created.defaultBranch.length).toBeGreaterThan(0);

      // (b) get — should return the newly created repo
      const fetched = await adapter.get(OWNER!, repoName);
      expect(fetched).not.toBeNull();
      expect(fetched!.owner).toBe(OWNER!);
      expect(fetched!.name).toBe(repoName);
      expect(fetched!.visibility).toBe('private');

      // (c) delete
      await adapter.delete(created, 'confirm-delete' as Parameters<typeof adapter.delete>[1]);

      // (d) get after delete — must return null (404 → null)
      const afterDelete = await adapter.get(OWNER!, repoName);
      expect(afterDelete).toBeNull();
    } finally {
      // Best-effort cleanup in case an assertion above failed before delete.
      // If delete already succeeded, this throws 404-based NOT_FOUND — swallow it.
      if (created !== undefined) {
        await adapter.delete(created, 'confirm-delete' as Parameters<typeof adapter.delete>[1]).catch(() => undefined);
      }
    }
  }, 60_000);
});
