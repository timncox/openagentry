/**
 * list operation: enumerate pages in workspace + project vaults.
 *
 * @module
 */

import { relative as relPath } from 'node:path';
import type { IsoTimestamp, WikiPage, WikiScope } from '@openagentry/core';
import { isAgentryError } from '@openagentry/core';
import { readFileSafe, statSafe, walkDir } from '../fs.js';
import { WIKI_FS_ERROR_CODES } from '../errors.js';
import { parseFrontmatter, resolveTitle } from '../frontmatter.js';
import { prefixedPath } from '../scope.js';
import type { WikiFsContext } from '../types.js';

async function listOneVault(
  vaultRoot: string,
  scope: 'workspace' | 'project',
): Promise<WikiPage[]> {
  const files = await walkDir(vaultRoot);
  const pages: WikiPage[] = [];
  for (const absolute of files) {
    try {
      const rel = relPath(vaultRoot, absolute).split('\\').join('/'); // normalize on win32
      const raw = await readFileSafe(absolute, 'list');
      const { data, content } = parseFrontmatter(raw);
      const title = resolveTitle(data, content, rel);
      const { mtimeMs } = await statSafe(absolute, 'list');
      pages.push({
        path: prefixedPath(scope, rel),
        scope,
        title,
        updatedAt: new Date(mtimeMs).toISOString() as IsoTimestamp,
      });
    } catch (err) {
      // File may have been deleted between walkDir and read — skip silently.
      // Same defensive idiom walkDir uses for ENOENT at directory level.
      if (isAgentryError(err) && err.code === WIKI_FS_ERROR_CODES.NOT_FOUND) {
        continue;
      }
      throw err;
    }
  }
  return pages;
}

export async function listOp(
  ctx: WikiFsContext,
  scope?: WikiScope,
): Promise<WikiPage[]> {
  const s = scope ?? 'all';
  const out: WikiPage[] = [];
  if (s === 'workspace' || s === 'all') {
    out.push(...(await listOneVault(ctx.workspaceRoot, 'workspace')));
  }
  if ((s === 'project' || s === 'all') && ctx.projectRoot !== undefined) {
    out.push(...(await listOneVault(ctx.projectRoot, 'project')));
  }
  return out;
}
