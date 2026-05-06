import { describe, it, expect } from 'vitest';
import {
  isAgentryError,
  type ConfirmToken,
  type DatabaseInstance,
  type IsoTimestamp,
  type Region,
} from '@openagentry/core';
import { createNeonDatabaseAdapter } from '../src/adapter.js';
import { makeMockFetch, baseConfigInput } from './helpers/mock-fetch.js';

describe('createNeonDatabaseAdapter', () => {
  it('returns an adapter with category="db" and id="neon"', () => {
    const { fetch } = makeMockFetch();
    const adapter = createNeonDatabaseAdapter({ ...baseConfigInput, fetch });
    expect(adapter.category).toBe('db');
    expect(adapter.id).toBe('neon');
  });

  it('exposes every DatabaseAdapter method', () => {
    const { fetch } = makeMockFetch();
    const adapter = createNeonDatabaseAdapter({ ...baseConfigInput, fetch });
    for (const method of [
      'createInstance',
      'destroyInstance',
      'connectionString',
      'exportState',
      'importState',
    ]) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('end-to-end: createInstance → connectionString round-trips', async () => {
    const { fetch } = makeMockFetch(
      // createInstance: search → empty
      { body: { projects: [] } },
      // createInstance: POST /projects
      {
        body: {
          project: { id: 'project-id-1', name: 'oa-my-app', region_id: 'aws-us-east-2', created_at: 't' },
          branch: { id: 'br-main-1', project_id: 'project-id-1', name: 'main', default: true, created_at: 't' },
        },
      },
      // connectionString: list branches
      {
        body: {
          branches: [{ id: 'br-main-1', project_id: 'project-id-1', name: 'main', default: true, created_at: 't' }],
        },
      },
      // connectionString: connection_uri
      { body: { uri: 'postgres://user:pw@ep/db' } },
    );
    const adapter = createNeonDatabaseAdapter({ ...baseConfigInput, fetch });
    const inst = await adapter.createInstance({ name: 'X', slug: 'my-app', engine: 'postgres' });
    const uri = await adapter.connectionString(inst, 'prod');
    expect(uri).toMatch(/^postgres:\/\//);
  });

  it('destroyInstance with empty ConfirmToken throws AgentryError', async () => {
    const { fetch } = makeMockFetch();
    const adapter = createNeonDatabaseAdapter({ ...baseConfigInput, fetch });
    const inst: DatabaseInstance = {
      id: 'i', dbId: 'p', name: 'x', slug: 'x', engine: 'postgres',
      region: 'aws-us-east-2' as Region,
      createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
    };
    const err = await adapter.destroyInstance(inst, '' as ConfirmToken).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('destroyInstance');
  });
});
