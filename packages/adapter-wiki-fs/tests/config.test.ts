import { describe, expect, it } from 'vitest';
import { parseWikiFsConfig } from '../src/config.js';

describe('parseWikiFsConfig', () => {
  it('accepts a minimal valid config (workspaceVaultPath only)', () => {
    const c = parseWikiFsConfig({ workspaceVaultPath: '/tmp/wiki' });
    expect(c.workspaceVaultPath).toBe('/tmp/wiki');
    expect(c.projectVaultPath).toBeUndefined();
    expect(c.search).toBeUndefined();
  });

  it('accepts full config with both paths and search opts', () => {
    const c = parseWikiFsConfig({
      workspaceVaultPath: '/tmp/wiki',
      projectVaultPath: '/tmp/proj',
      search: { maxResults: 50, snippetLength: 300 },
    });
    expect(c.projectVaultPath).toBe('/tmp/proj');
    expect(c.search?.maxResults).toBe(50);
    expect(c.search?.snippetLength).toBe(300);
  });

  it('rejects empty workspaceVaultPath', () => {
    expect(() => parseWikiFsConfig({ workspaceVaultPath: '' })).toThrow(/E_WIKI_FS_SCHEMA/);
  });

  it('rejects unknown keys (.strict())', () => {
    expect(() =>
      parseWikiFsConfig({ workspaceVaultPath: '/tmp', extraKey: 'nope' }),
    ).toThrow(/E_WIKI_FS_SCHEMA/);
  });

  it('rejects non-positive search.maxResults', () => {
    expect(() =>
      parseWikiFsConfig({ workspaceVaultPath: '/tmp', search: { maxResults: 0 } }),
    ).toThrow(/E_WIKI_FS_SCHEMA/);
  });
});
