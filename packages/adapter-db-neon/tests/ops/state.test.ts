import { describe, it, expect } from 'vitest';
import type {
  DatabaseInstance,
  DatabaseStateBundle,
  IsoTimestamp,
  Region,
} from '@openagentry/core';
import { neonApi } from '../../src/client.js';
import { exportState, importState } from '../../src/ops/state.js';
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

describe('exportState', () => {
  it('returns a v1 bundle with a vendor marker snapshotRef', async () => {
    const { fetch } = makeMockFetch({
      body: { project: { id: 'project-id-1', name: 'oa-my-app', region_id: 'aws-us-east-2', created_at: 't' } },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const bundle = await exportState(api, inst);
    expect(bundle.version).toBe(1);
    expect(bundle.instance.dbId).toBe('project-id-1');
    expect(bundle.snapshotRef).toMatch(/^neon:project:project-id-1:as-of:/);
  });
});

describe('importState', () => {
  it('returns existing instance when slug already exists (1 GET only)', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { projects: [{ id: 'project-id-1', name: 'oa-my-app', region_id: 'aws-us-east-2', created_at: 't' }] },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const bundle: DatabaseStateBundle = {
      version: 1,
      instance: inst,
      snapshotRef: 'neon:project:project-id-1:as-of:t',
    };
    const result = await importState(api, bundle);
    expect(result.dbId).toBe('project-id-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('GET');
  });

  it('creates the project when slug not found', async () => {
    const { fetch, calls } = makeMockFetch(
      // 1. find by slug → empty
      { body: { projects: [] } },
      // 2. createInstance internal: search again (idempotency check)
      { body: { projects: [] } },
      // 3. POST /projects
      {
        body: {
          project: { id: 'project-id-2', name: 'oa-my-app', region_id: 'aws-us-east-2', created_at: 't' },
          branch: { id: 'br-main-1', project_id: 'project-id-2', name: 'main', default: true, created_at: 't' },
        },
      },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const bundle: DatabaseStateBundle = {
      version: 1,
      instance: inst,
      snapshotRef: 'neon:project:project-id-1:as-of:t',
    };
    const result = await importState(api, bundle);
    expect(result.dbId).toBe('project-id-2');
    expect(result.slug).toBe('my-app');
    expect(calls).toHaveLength(3);
  });
});
