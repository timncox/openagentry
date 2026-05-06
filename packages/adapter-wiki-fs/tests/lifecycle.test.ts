import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { healthcheck, init, refresh } from '../src/lifecycle.js';
import type { WikiFsContext } from '../src/types.js';

let wsRoot: string;
let ctx: WikiFsContext;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-life-'));
  ctx = { config: { workspaceVaultPath: wsRoot }, workspaceRoot: wsRoot };
});
afterEach(async () => rm(wsRoot, { recursive: true, force: true }));

describe('init', () => {
  it('passes when workspace vault exists', async () => {
    await expect(init(ctx)).resolves.toBeUndefined();
  });

  it('creates workspace vault if missing parent dir is writable', async () => {
    const target = join(wsRoot, 'sub-vault');
    const ctx2: WikiFsContext = {
      config: { workspaceVaultPath: target },
      workspaceRoot: target,
    };
    await init(ctx2);
    const { stat } = await import('node:fs/promises');
    expect((await stat(target)).isDirectory()).toBe(true);
  });

  it('also creates projectRoot if configured', async () => {
    const projectTarget = join(wsRoot, 'project-vault');
    const ctxBoth: WikiFsContext = {
      config: { workspaceVaultPath: wsRoot, projectVaultPath: projectTarget },
      workspaceRoot: wsRoot,
      projectRoot: projectTarget,
    };
    await init(ctxBoth);
    const { stat } = await import('node:fs/promises');
    expect((await stat(projectTarget)).isDirectory()).toBe(true);
  });
});

describe('refresh', () => {
  it('is a no-op (resolves to undefined)', async () => {
    await expect(refresh(ctx)).resolves.toBeUndefined();
  });
});

describe('healthcheck', () => {
  it('passes when readdir works', async () => {
    await expect(healthcheck(ctx)).resolves.toBeUndefined();
  });

  it('throws AgentryError when root is unreadable', async () => {
    const bad: WikiFsContext = {
      config: { workspaceVaultPath: '/nonexistent/agentry/vault' },
      workspaceRoot: '/nonexistent/agentry/vault',
    };
    await expect(healthcheck(bad)).rejects.toThrow(/E_WIKI_FS_/);
  });
});
