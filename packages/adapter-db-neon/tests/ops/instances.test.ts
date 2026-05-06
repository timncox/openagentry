import { describe, it, expect } from 'vitest';
import { isAgentryError, type ConfirmToken, type IsoTimestamp } from '@openagentry/core';
import type { DatabaseInstance, Region } from '@openagentry/core';
import { neonApi } from '../../src/client.js';
import {
  createInstance,
  destroyInstance,
  getInstanceBySlug,
} from '../../src/ops/instances.js';
import { makeMockFetch, baseConfigInput } from '../helpers/mock-fetch.js';

const projectFixture = {
  id: 'project-id-1',
  name: 'oa-my-app',
  region_id: 'aws-us-east-2',
  created_at: '2026-01-01T00:00:00Z',
};

const branchFixture = {
  id: 'br-main-1',
  project_id: 'project-id-1',
  name: 'main',
  default: true,
  created_at: '2026-01-01T00:00:00Z',
};

describe('createInstance', () => {
  it('POSTs /projects and returns DatabaseInstance', async () => {
    const { fetch, calls } = makeMockFetch(
      // 1. search by name → empty
      { body: { projects: [] } },
      // 2. POST /projects → success
      { body: { project: projectFixture, branch: branchFixture } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    const inst = await createInstance(api, {
      name: 'My App',
      slug: 'my-app',
      engine: 'postgres',
    });
    expect(inst.dbId).toBe('project-id-1');
    expect(inst.slug).toBe('my-app');
    expect(inst.engine).toBe('postgres');
    expect(inst.region).toBe('aws-us-east-2');
    expect(calls[1]?.method).toBe('POST');
    const body = JSON.parse(calls[1]?.body ?? '{}');
    expect(body.project.name).toBe('oa-my-app');
    expect(body.project.region_id).toBe('aws-us-east-2');
  });

  it('rejects engines other than postgres with E_NEON_SCHEMA', async () => {
    const { fetch } = makeMockFetch();
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await createInstance(api, {
      name: 'X',
      slug: 'x',
      engine: 'mysql',
    }).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.code).toBe('E_NEON_SCHEMA');
    expect(err.suggestedFix).toMatch(/postgres/i);
  });

  it('is idempotent: returns existing instance when slug already exists', async () => {
    const { fetch, calls } = makeMockFetch({
      body: { projects: [projectFixture] },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    const inst = await createInstance(api, {
      name: 'My App',
      slug: 'my-app',
      engine: 'postgres',
    });
    expect(inst.dbId).toBe('project-id-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('GET');
  });

  it('passes region from opts to Neon body', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: { projects: [] } },
      { body: { project: { ...projectFixture, region_id: 'aws-us-west-2' }, branch: branchFixture } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    await createInstance(api, {
      name: 'X',
      slug: 'x',
      engine: 'postgres',
      region: 'aws-us-west-2' as Region,
    });
    const body = JSON.parse(calls[1]?.body ?? '{}');
    expect(body.project.region_id).toBe('aws-us-west-2');
  });

  it('creates preview + dev branches when perEnvBranches is true', async () => {
    const { fetch, calls } = makeMockFetch(
      { body: { projects: [] } },
      { body: { project: projectFixture, branch: branchFixture } },
      // POST preview branch
      { body: { branch: { ...branchFixture, id: 'br-preview-1', name: 'preview' } } },
      // POST dev branch
      { body: { branch: { ...branchFixture, id: 'br-dev-1', name: 'dev' } } },
    );
    const api = neonApi({ ...baseConfigInput, fetch });
    await createInstance(api, {
      name: 'X',
      slug: 'x',
      engine: 'postgres',
      perEnvBranches: true,
    });
    expect(calls).toHaveLength(4);
    expect(calls[2]?.url).toContain('/projects/project-id-1/branches');
    expect(calls[3]?.url).toContain('/projects/project-id-1/branches');
    expect(JSON.parse(calls[2]?.body ?? '{}').branch.name).toBe('preview');
    expect(JSON.parse(calls[3]?.body ?? '{}').branch.name).toBe('dev');
  });
});

describe('destroyInstance', () => {
  const inst: DatabaseInstance = {
    id: 'instance-1',
    dbId: 'project-id-1',
    name: 'My App',
    slug: 'my-app',
    engine: 'postgres',
    region: 'aws-us-east-2' as Region,
    createdAt: '2026-01-01T00:00:00Z' as IsoTimestamp,
  };

  it('DELETEs /projects/{id} when given a non-empty ConfirmToken', async () => {
    const { fetch, calls } = makeMockFetch({
      status: 200,
      body: { project: projectFixture },
    });
    const api = neonApi({ ...baseConfigInput, fetch });
    await destroyInstance(api, inst, 'i-am-sure' as ConfirmToken);
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toContain('/projects/project-id-1');
  });

  it('rejects empty ConfirmToken with AgentryError(phase: destroyInstance)', async () => {
    const { fetch } = makeMockFetch();
    const api = neonApi({ ...baseConfigInput, fetch });
    const err = await destroyInstance(api, inst, '' as ConfirmToken).catch((e: unknown) => e);
    if (!isAgentryError(err)) throw new Error('expected AgentryError');
    expect(err.phase).toBe('destroyInstance');
    expect(err.code).toBe('E_NEON_SCHEMA');
  });
});

describe('getInstanceBySlug', () => {
  it('returns null on no match (empty projects array)', async () => {
    const { fetch } = makeMockFetch({ body: { projects: [] } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const inst = await getInstanceBySlug(api, 'never-exists', 'createInstance' as never);
    expect(inst).toBeNull();
  });

  it('returns the matched instance shape', async () => {
    const { fetch } = makeMockFetch({ body: { projects: [projectFixture] } });
    const api = neonApi({ ...baseConfigInput, fetch });
    const inst = await getInstanceBySlug(api, 'my-app', 'createInstance' as never);
    expect(inst?.dbId).toBe('project-id-1');
    expect(inst?.slug).toBe('my-app');
  });
});
