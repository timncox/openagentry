import { describe, expect, it } from 'vitest';
import { resolveScope, prefixedPath } from '../src/scope.js';
import type { WikiFsContext } from '../src/types.js';

const ctx: WikiFsContext = {
  config: { workspaceVaultPath: '/ws', projectVaultPath: '/proj' },
  workspaceRoot: '/ws',
  projectRoot: '/proj',
};

const ctxWsOnly: WikiFsContext = {
  config: { workspaceVaultPath: '/ws' },
  workspaceRoot: '/ws',
};

describe('resolveScope', () => {
  it('routes workspace/ prefix to workspace vault', () => {
    const r = resolveScope(ctx, 'workspace/a.md', 'read');
    expect(r.scope).toBe('workspace');
    expect(r.relativePath).toBe('a.md');
    expect(r.vaultRoot).toBe('/ws');
  });

  it('routes project/ prefix to project vault', () => {
    const r = resolveScope(ctx, 'project/a.md', 'read');
    expect(r.scope).toBe('project');
    expect(r.relativePath).toBe('a.md');
  });

  it('defaults to workspace for unprefixed path', () => {
    const r = resolveScope(ctx, 'a.md', 'read');
    expect(r.scope).toBe('workspace');
    expect(r.prefixedPath).toBe('workspace/a.md');
  });

  it('throws E_WIKI_FS_NO_PROJECT_VAULT for project/ path when no project vault', () => {
    expect(() => resolveScope(ctxWsOnly, 'project/a.md', 'read')).toThrow(
      /E_WIKI_FS_NO_PROJECT_VAULT/,
    );
  });

  it('rejects bare project/ prefix with E_WIKI_FS_NOT_FOUND', () => {
    expect(() => resolveScope(ctx, 'project/', 'read')).toThrow(/E_WIKI_FS_NOT_FOUND/);
  });

  it('rejects bare workspace/ prefix with E_WIKI_FS_NOT_FOUND', () => {
    expect(() => resolveScope(ctx, 'workspace/', 'read')).toThrow(/E_WIKI_FS_NOT_FOUND/);
  });
});

describe('prefixedPath', () => {
  it('joins scope + relativePath with /', () => {
    expect(prefixedPath('workspace', 'a/b.md')).toBe('workspace/a/b.md');
    expect(prefixedPath('project', 'x.md')).toBe('project/x.md');
  });
});
