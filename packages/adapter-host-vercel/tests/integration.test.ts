import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createVercelHostAdapter } from '../src/adapter.js';
import { VERCEL_ERROR_CODES } from '../src/errors.js';
import type { ConfirmToken, HostProject } from '@openagentry/core';

/**
 * Integration tests against the real Vercel REST API.
 *
 * Required env var to enable the suite:
 *   OA_VERCEL_INTEGRATION_TEST_TOKEN — Vercel Personal Access Token with
 *     project create/delete + env read/write scopes.
 *
 * Optional env var to enable the full lifecycle test:
 *   OA_VERCEL_INTEGRATION_TEST_FULL=1 — when set, runs create→setEnv→getEnv→destroy.
 *     Only opt in when you have a throwaway Vercel account or team.
 *
 * Run (gated only, no full lifecycle):
 *   OA_VERCEL_INTEGRATION_TEST_TOKEN=xxx \
 *     pnpm --filter @openagentry/adapter-host-vercel test tests/integration.test.ts
 *
 * Run (with full lifecycle):
 *   OA_VERCEL_INTEGRATION_TEST_TOKEN=xxx \
 *   OA_VERCEL_INTEGRATION_TEST_FULL=1 \
 *     pnpm --filter @openagentry/adapter-host-vercel test tests/integration.test.ts
 */

const TEST_TOKEN = process.env['OA_VERCEL_INTEGRATION_TEST_TOKEN'];
const FULL = process.env['OA_VERCEL_INTEGRATION_TEST_FULL'] === '1';

const hasToken =
  typeof TEST_TOKEN === 'string' && TEST_TOKEN.length > 0;

function makeAdapter(token: string) {
  return createVercelHostAdapter({ token });
}

describe.skipIf(!hasToken)(
  'Vercel integration (requires OA_VERCEL_INTEGRATION_TEST_TOKEN env)',
  () => {
    // Test 1: bogus token → createProject must throw AUTH
    it(
      'createProject with bogus token throws E_VERCEL_AUTH',
      async () => {
        const adapter = makeAdapter('bogus_token_00000000000000000000000000000000');
        await expect(
          adapter.createProject({ name: 'oa-bogus-test', slug: 'oa-bogus-test' }),
        ).rejects.toMatchObject({
          code: VERCEL_ERROR_CODES.AUTH,
        });
      },
      30_000,
    );

    // Test 2: full lifecycle (gated behind OA_VERCEL_INTEGRATION_TEST_FULL=1)
    it.skipIf(!FULL)(
      'full lifecycle: create → setEnv → getEnv (asserts FOO present) → destroyProject',
      async () => {
        const adapter = makeAdapter(TEST_TOKEN!);
        const projectName = `oa-test-${randomUUID()}`;
        let createdProject: HostProject | null = null;

        try {
          // Step 1: create
          createdProject = await adapter.createProject({
            name: projectName,
            slug: projectName,
          });
          expect(createdProject.name).toBe(projectName);
          expect(typeof createdProject.hostId).toBe('string');
          expect(createdProject.hostId.length).toBeGreaterThan(0);

          // Step 2: setEnv
          await adapter.setEnv(createdProject, { FOO: 'integration-test-value' }, 'prod');

          // Step 3: getEnv — assert FOO is present with the set value
          const vars = await adapter.getEnv(createdProject, 'prod');
          expect(vars['FOO']).toBe('integration-test-value');

          // Step 4: destroyProject
          await adapter.destroyProject(
            createdProject,
            'integration-test-confirm' as ConfirmToken,
          );
          createdProject = null;
        } finally {
          // Best-effort cleanup if test failed before destroyProject
          if (createdProject !== null) {
            try {
              await adapter.destroyProject(
                createdProject,
                'integration-test-cleanup' as ConfirmToken,
              );
            } catch {
              // Ignore cleanup errors — underlying test already failed
            }
          }
        }
      },
      120_000,
    );
  },
);
