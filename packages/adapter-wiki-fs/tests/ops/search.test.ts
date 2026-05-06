import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { searchOp } from '../../src/ops/search.js';
import type { WikiFsContext } from '../../src/types.js';

let wsRoot: string;
let projRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-search-ws-'));
  projRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-search-proj-'));
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

describe('searchOp', () => {
  it('returns empty for no matches', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'unrelated content');
    expect(await searchOp(ctx, 'needle')).toEqual([]);
  });

  it('returns hits with snippet, score, prefixed path, scope', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'before needle after');
    const hits = await searchOp(ctx, 'needle');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe('workspace/a.md');
    expect(hits[0]?.scope).toBe('workspace');
    expect(hits[0]?.snippet).toContain('needle');
    expect(hits[0]?.score).toBe(1);
  });

  it('ranks higher-frequency files first', async () => {
    await writeFile(join(wsRoot, 'low.md'), 'needle');
    await writeFile(join(wsRoot, 'high.md'), 'needle needle needle');
    const hits = await searchOp(ctx, 'needle');
    expect(hits[0]?.path).toBe('workspace/high.md');
    expect(hits[0]?.score).toBe(3);
    expect(hits[1]?.score).toBe(1);
  });

  it('respects scope:project (workspace files invisible)', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'needle');
    await writeFile(join(projRoot, 'b.md'), 'needle');
    const hits = await searchOp(ctx, 'needle', 'project');
    expect(hits.map((h) => h.path)).toEqual(['project/b.md']);
  });

  it('case-insensitive', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'NEEDLE');
    const hits = await searchOp(ctx, 'needle');
    expect(hits).toHaveLength(1);
  });

  it('matches frontmatter values', async () => {
    await writeFile(join(wsRoot, 'a.md'), '---\ntitle: needle in title\n---\nbody');
    const hits = await searchOp(ctx, 'needle');
    expect(hits).toHaveLength(1);
  });

  it('honors search.maxResults config', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'needle');
    await writeFile(join(wsRoot, 'b.md'), 'needle');
    await writeFile(join(wsRoot, 'c.md'), 'needle');
    const ctxLimited: WikiFsContext = {
      config: { workspaceVaultPath: wsRoot, search: { maxResults: 2 } },
      workspaceRoot: wsRoot,
    };
    const hits = await searchOp(ctxLimited, 'needle');
    expect(hits).toHaveLength(2);
  });
});
