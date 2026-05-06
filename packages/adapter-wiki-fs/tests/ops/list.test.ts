import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listOp } from '../../src/ops/list.js';
import type { WikiFsContext } from '../../src/types.js';

let wsRoot: string;
let projRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-list-ws-'));
  projRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-list-proj-'));
  ctx = {
    config: { workspaceVaultPath: wsRoot, projectVaultPath: projRoot },
    workspaceRoot: wsRoot,
    projectRoot: projRoot,
  };
});

afterEach(async () => {
  await rm(wsRoot, { recursive: true, force: true });
  await rm(projRoot, { recursive: true, force: true });
});

describe('listOp', () => {
  it('returns empty array for empty vaults', async () => {
    expect(await listOp(ctx)).toEqual([]);
  });

  it('lists workspace files with workspace/ prefix', async () => {
    await writeFile(join(wsRoot, 'a.md'), '---\ntitle: Alpha\n---\n\nbody\n');
    const out = await listOp(ctx, 'workspace');
    expect(out).toHaveLength(1);
    expect(out[0]?.path).toBe('workspace/a.md');
    expect(out[0]?.scope).toBe('workspace');
    expect(out[0]?.title).toBe('Alpha');
    expect(typeof out[0]?.updatedAt).toBe('string');
  });

  it('lists project files with project/ prefix', async () => {
    await writeFile(join(projRoot, 'b.md'), '# Beta\nbody\n');
    const out = await listOp(ctx, 'project');
    expect(out).toHaveLength(1);
    expect(out[0]?.path).toBe('project/b.md');
    expect(out[0]?.title).toBe('Beta');
  });

  it('"all" merges both scopes', async () => {
    await writeFile(join(wsRoot, 'a.md'), '# A\n');
    await writeFile(join(projRoot, 'b.md'), '# B\n');
    const out = await listOp(ctx, 'all');
    expect(out).toHaveLength(2);
    const paths = out.map((p) => p.path).sort();
    expect(paths).toEqual(['project/b.md', 'workspace/a.md']);
  });

  it('walks subdirectories', async () => {
    await mkdir(join(wsRoot, 'sub'));
    await writeFile(join(wsRoot, 'sub/c.md'), '# C\n');
    const out = await listOp(ctx, 'workspace');
    expect(out.map((p) => p.path)).toEqual(['workspace/sub/c.md']);
  });

  it('returns empty for project scope when projectRoot not configured', async () => {
    const ctxWs: WikiFsContext = {
      config: { workspaceVaultPath: wsRoot },
      workspaceRoot: wsRoot,
    };
    expect(await listOp(ctxWs, 'project')).toEqual([]);
  });
});
