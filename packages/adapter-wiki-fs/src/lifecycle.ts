/**
 * Lifecycle hooks for adapter-wiki-fs.
 *
 * - init: ensures workspace vault exists; auto-creates if missing.
 * - refresh: no-op (no caching in v0).
 * - healthcheck: readdir on workspace vault must succeed.
 *
 * @module
 */

import { mkdir, readdir } from 'node:fs/promises';
import { fsErrorToWikiError } from './errors.js';
import type { WikiFsContext } from './types.js';

export async function init(ctx: WikiFsContext): Promise<void> {
  try {
    await mkdir(ctx.workspaceRoot, { recursive: true });
  } catch (err) {
    throw fsErrorToWikiError(err, 'init', ctx.workspaceRoot);
  }
  if (ctx.projectRoot !== undefined) {
    try {
      await mkdir(ctx.projectRoot, { recursive: true });
    } catch (err) {
      throw fsErrorToWikiError(err, 'init', ctx.projectRoot);
    }
  }
}

export async function refresh(_ctx: WikiFsContext): Promise<void> {
  // no-op; no cache to invalidate.
}

export async function healthcheck(ctx: WikiFsContext): Promise<void> {
  try {
    await readdir(ctx.workspaceRoot);
  } catch (err) {
    throw fsErrorToWikiError(err, 'init', ctx.workspaceRoot);
  }
}
