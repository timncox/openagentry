import { describe, it, expect } from 'vitest';
import {
  isAgentryError,
  type DatabaseInstance,
  type Env,
  type IsoTimestamp,
  type Region,
} from '@openagentry/core';
import { neonApi } from '../../src/client.js';
import { connectionString } from '../../src/ops/connections.js';
import { makeMockFetch, baseConfigInput } from '../helpers/mock-fetch.js';

const inst: DatabaseInstance = {
  id: 'instance-1',
  dbId: 'project-id-1',
  name: 'My App',
  slug: 'my-app',
  engine: 'postgres',
  region: 'aws-us-east-2' as Region,
  createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
};

describe('connectionString', () => {
  it('returns the postgres URI for the main branch on env=prod', async () => {
    const { fetch, calls } = makeMockFetch(
      // List branches → main present
      { body: { branches: [{ id: 'br-main-1', project_id: 'project-id-1', name: 'main', default: true, created_at: '2026-01-01T00:00:00Z' }] } },
      // Connection URI
      { body: { uri: 'postgres://user:pw@ep-1.aws.neon.tech/neondb' } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const uri = await connectionString(api, inst, 'prod' as Env);
    expect(uri).toBe('postgres://user:pw@ep-1.aws.neon.tech/neondb');
    expect(calls[0]?.url).toContain('/projects/project-id-1/branches');
    expect(calls[1]?.url).toContain('branch_id=br-main-1');
  });

  it('uses the preview branch on env=preview', async () => {
    const { fetch, calls } = makeMockFetch(
      {
        body: {
          branches: [
            { id: 'br-main-1', project_id: 'project-id-1', name: 'main', default: true, created_at: 't' },
            { id: 'br-prev-1', project_id: 'project-id-1', name: 'preview', default: false, created_at: 't' },
          ],
        },
      },
      { body: { uri: 'postgres://user@ep-prev/db' } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const uri = await connectionString(api, inst, 'preview' as Env);
    expect(uri).toBe('postgres://user@ep-prev/db');
    expect(calls[1]?.url).toContain('branch_id=br-prev-1');
  });

  it('throws E_NEON_NOT_FOUND with suggestedFix when env=preview but no preview branch', async () => {
    const { fetch } = makeMockFetch({
      body: { branches: [{ id: 'br-main-1', project_id: 'project-id-1', name: 'main', default: true, created_at: 't' }] },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await connectionString(api, inst, 'preview' as Env).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_NEON_NOT_FOUND');
    expect(err.phase).toBe('connectionString');
    expect(err.suggestedFix).toMatch(/perEnvBranches/);
  });

  it('rejects unknown env with E_NEON_SCHEMA', async () => {
    const { fetch } = makeMockFetch();
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await connectionString(api, inst, 'staging' as unknown as Env).catch(
      (e: unknown) => e,
    );
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_NEON_SCHEMA');
  });
});
