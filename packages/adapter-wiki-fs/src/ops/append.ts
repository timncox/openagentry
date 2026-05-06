/**
 * append operation: appends content to a file, creating it if missing.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { createPatch } from 'diff';
import type { WikiWriteResult } from '@openagentry/core';
import { fsErrorToWikiError } from '../errors.js';
import { writeFileAtomic } from '../fs.js';
import { resolveScope } from '../scope.js';
import type { WikiFsContext } from '../types.js';

export async function appendOp(
  ctx: WikiFsContext,
  path: string,
  content: string,
): Promise<WikiWriteResult> {
  const target = resolveScope(ctx, path, 'append');

  let prior: string | undefined;
  try {
    prior = await readFile(target.absolutePath, 'utf8');
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'ENOENT') {
      throw fsErrorToWikiError(err, 'append', target.absolutePath);
    }
    prior = undefined;
  }

  let next: string;
  if (prior === undefined) {
    next = content;
  } else {
    const sep = prior.endsWith('\n') || prior.length === 0 ? '' : '\n';
    next = prior + sep + content;
  }

  await writeFileAtomic(target.absolutePath, next);

  if (prior === undefined) {
    return { path: target.prefixedPath, status: 'created' };
  }
  const diff = createPatch(target.prefixedPath, prior, next, '', '');
  return { path: target.prefixedPath, status: 'updated', diff };
}
