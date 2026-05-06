import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readOp } from '../../src/ops/read.js';
import type { WikiFsContext } from '../../src/types.js';

let wsRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-read-'));
  ctx = { config: { workspaceVaultPath: wsRoot }, workspaceRoot: wsRoot };
});
afterEach(async () => rm(wsRoot, { recursive: true, force: true }));

describe('readOp', () => {
  it('returns full file contents including frontmatter', async () => {
    const raw = '---\ntitle: A\n---\n\nbody\n';
    await writeFile(join(wsRoot, 'a.md'), raw);
    expect(await readOp(ctx, 'workspace/a.md')).toBe(raw);
  });

  it('handles unprefixed path as workspace', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'content');
    expect(await readOp(ctx, 'a.md')).toBe('content');
  });

  it('throws E_WIKI_FS_NOT_FOUND for missing path', async () => {
    await expect(readOp(ctx, 'workspace/missing.md')).rejects.toThrow(
      /E_WIKI_FS_NOT_FOUND/,
    );
  });

  it('throws E_WIKI_FS_OUT_OF_VAULT for ".." escape', async () => {
    await expect(readOp(ctx, 'workspace/../escape.md')).rejects.toThrow(
      /E_WIKI_FS_OUT_OF_VAULT/,
    );
  });
});
