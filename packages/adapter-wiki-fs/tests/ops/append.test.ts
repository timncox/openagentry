import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendOp } from '../../src/ops/append.js';
import type { WikiFsContext } from '../../src/types.js';

let wsRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-append-'));
  ctx = { config: { workspaceVaultPath: wsRoot }, workspaceRoot: wsRoot };
});
afterEach(async () => rm(wsRoot, { recursive: true, force: true }));

describe('appendOp', () => {
  it('creates a new file with status:created when missing', async () => {
    const r = await appendOp(ctx, 'workspace/a.md', 'first\n');
    expect(r.status).toBe('created');
    expect(await readFile(join(wsRoot, 'a.md'), 'utf8')).toBe('first\n');
  });

  it('extends existing file with newline separator if needed', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'one');
    const r = await appendOp(ctx, 'workspace/a.md', 'two\n');
    expect(r.status).toBe('updated');
    expect(typeof r.diff).toBe('string');
    expect(await readFile(join(wsRoot, 'a.md'), 'utf8')).toBe('one\ntwo\n');
  });

  it('does not double-newline if existing ends in newline', async () => {
    await writeFile(join(wsRoot, 'a.md'), 'one\n');
    await appendOp(ctx, 'workspace/a.md', 'two\n');
    expect(await readFile(join(wsRoot, 'a.md'), 'utf8')).toBe('one\ntwo\n');
  });

  it('rejects ".." escape', async () => {
    await expect(appendOp(ctx, 'workspace/../e.md', 'x')).rejects.toThrow(
      /E_WIKI_FS_OUT_OF_VAULT/,
    );
  });
});
