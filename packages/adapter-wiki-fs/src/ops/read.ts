/**
 * read operation: returns raw file contents (frontmatter included).
 *
 * @module
 */

import { readFileSafe } from '../fs.js';
import { resolveScope } from '../scope.js';
import type { WikiFsContext } from '../types.js';

export async function readOp(ctx: WikiFsContext, path: string): Promise<string> {
  const target = resolveScope(ctx, path, 'read');
  return readFileSafe(target.absolutePath, 'read');
}
