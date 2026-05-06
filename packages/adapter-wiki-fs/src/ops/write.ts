/**
 * write operation: atomic write with diff computation.
 *
 * @module
 */

import { createPatch } from 'diff';
import type { WikiWriteResult } from '@openagentry/core';
import { fsErrorToWikiError } from '../errors.js';
import { writeFileAtomic } from '../fs.js';
import { resolveScope } from '../scope.js';
import { readFile } from 'node:fs/promises';
import type { WikiFsContext } from '../types.js';

export async function writeOp(
  ctx: WikiFsContext,
  path: string,
  content: string,
): Promise<WikiWriteResult> {
  const target = resolveScope(ctx, path, 'write');

  let prior: string | undefined;
  try {
    prior = await readFile(target.absolutePath, 'utf8');
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'ENOENT') {
      throw fsErrorToWikiError(err, 'write', target.absolutePath);
    }
    prior = undefined;
  }

  if (prior === content) {
    return { path: target.prefixedPath, status: 'unchanged' };
  }

  await writeFileAtomic(target.absolutePath, content);

  if (prior === undefined) {
    return { path: target.prefixedPath, status: 'created' };
  }

  const diff = createPatch(target.prefixedPath, prior, content, '', '');
  return { path: target.prefixedPath, status: 'updated', diff };
}
