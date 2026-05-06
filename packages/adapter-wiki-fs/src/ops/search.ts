/**
 * search operation: naive case-insensitive substring search.
 *
 * Counts non-overlapping occurrences as score; produces a snippet
 * centered on the first match.
 *
 * @module
 */

import { relative as relPath } from 'node:path';
import type { WikiHit, WikiScope } from '@openagentry/core';
import { isAgentryError } from '@openagentry/core';
import { readFileSafe, walkDir } from '../fs.js';
import { WIKI_FS_ERROR_CODES } from '../errors.js';
import { prefixedPath } from '../scope.js';
import type { WikiFsContext } from '../types.js';

const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_SNIPPET_LENGTH = 200;

function snippetAround(content: string, query: string, length: number): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx < 0) return content.slice(0, length);
  const half = Math.floor(length / 2);
  const start = Math.max(0, idx - half);
  return content.slice(start, start + length);
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const found = lowerHay.indexOf(lowerNeedle, pos);
    if (found < 0) break;
    count += 1;
    pos = found + lowerNeedle.length;
  }
  return count;
}

async function searchOneVault(
  vaultRoot: string,
  scope: 'workspace' | 'project',
  query: string,
  snippetLength: number,
): Promise<WikiHit[]> {
  const files = await walkDir(vaultRoot);
  const hits: WikiHit[] = [];
  for (const absolute of files) {
    try {
      const raw = await readFileSafe(absolute, 'search');
      const score = countOccurrences(raw, query);
      if (score > 0) {
        const rel = relPath(vaultRoot, absolute).split('\\').join('/');
        hits.push({
          path: prefixedPath(scope, rel),
          scope,
          snippet: snippetAround(raw, query, snippetLength),
          score,
        });
      }
    } catch (err) {
      // File may have been deleted between walkDir and read — skip silently.
      // Same defensive idiom listOneVault uses.
      if (isAgentryError(err) && err.code === WIKI_FS_ERROR_CODES.NOT_FOUND) {
        continue;
      }
      throw err;
    }
  }
  return hits;
}

export async function searchOp(
  ctx: WikiFsContext,
  query: string,
  scope?: WikiScope,
): Promise<WikiHit[]> {
  const s = scope ?? 'all';
  const maxResults = ctx.config.search?.maxResults ?? DEFAULT_MAX_RESULTS;
  const snippetLength = ctx.config.search?.snippetLength ?? DEFAULT_SNIPPET_LENGTH;

  const all: WikiHit[] = [];
  if (s === 'workspace' || s === 'all') {
    all.push(...(await searchOneVault(ctx.workspaceRoot, 'workspace', query, snippetLength)));
  }
  if ((s === 'project' || s === 'all') && ctx.projectRoot !== undefined) {
    all.push(...(await searchOneVault(ctx.projectRoot, 'project', query, snippetLength)));
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, maxResults);
}
