import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWikiFsAdapter } from '../src/adapter.js';

let wsRoot: string;

beforeEach(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'wiki-fs-adapter-'));
});
afterEach(async () => rm(wsRoot, { recursive: true, force: true }));

describe('createWikiFsAdapter', () => {
  it('returns a frozen adapter with category=wiki, id=wiki-fs', () => {
    const adapter = createWikiFsAdapter({ workspaceVaultPath: wsRoot });
    expect(adapter.category).toBe('wiki');
    expect(adapter.id).toBe('wiki-fs');
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('throws E_WIKI_FS_SCHEMA on invalid config', () => {
    expect(() => createWikiFsAdapter({ workspaceVaultPath: '' })).toThrow(
      /E_WIKI_FS_SCHEMA/,
    );
  });

  it('round-trips write → read', async () => {
    const adapter = createWikiFsAdapter({ workspaceVaultPath: wsRoot });
    const wr = await adapter.write('workspace/a.md', 'hi');
    expect(wr.status).toBe('created');
    expect(await adapter.read('workspace/a.md')).toBe('hi');
  });

  it('list returns array', async () => {
    const adapter = createWikiFsAdapter({ workspaceVaultPath: wsRoot });
    expect(await adapter.list()).toEqual([]);
  });
});
