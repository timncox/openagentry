import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeOp } from '../../src/ops/write.js';
import type { WikiFsContext } from '../../src/types.js';

let wsRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-write-'));
  ctx = { config: { workspaceVaultPath: wsRoot }, workspaceRoot: wsRoot };
});
afterEach(async () => rm(wsRoot, { recursive: true, force: true }));

describe('writeOp', () => {
  it('returns status:created for new file, no diff', async () => {
    const r = await writeOp(ctx, 'workspace/a.md', 'hello');
    expect(r.status).toBe('created');
    expect(r.path).toBe('workspace/a.md');
    expect(r.diff).toBeUndefined();
    expect(await readFile(join(wsRoot, 'a.md'), 'utf8')).toBe('hello');
  });

  it('returns status:updated with diff for changed content', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'old');
    const r = await writeOp(ctx, 'workspace/a.md', 'new');
    expect(r.status).toBe('updated');
    expect(typeof r.diff).toBe('string');
    expect(r.diff).toContain('-old');
    expect(r.diff).toContain('+new');
  });

  it('returns status:unchanged for identical content (no diff)', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'same');
    const r = await writeOp(ctx, 'workspace/a.md', 'same');
    expect(r.status).toBe('unchanged');
    expect(r.diff).toBeUndefined();
  });

  it('creates parent dirs', async () => {
    const r = await writeOp(ctx, 'workspace/sub/deep/x.md', 'x');
    expect(r.status).toBe('created');
    expect(await readFile(join(wsRoot, 'sub/deep/x.md'), 'utf8')).toBe('x');
  });

  it('rejects ".." escape', async () => {
    await expect(writeOp(ctx, 'workspace/../escape.md', 'x')).rejects.toThrow(
      /E_WIKI_FS_OUT_OF_VAULT/,
    );
  });
});
