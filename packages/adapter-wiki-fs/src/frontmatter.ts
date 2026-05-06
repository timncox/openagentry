/**
 * Frontmatter parsing + title resolution for adapter-wiki-fs.
 *
 * Wraps gray-matter so the rest of the adapter never imports it directly.
 *
 * @module
 */

import matter from 'gray-matter';
import { basename } from 'node:path';

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  try {
    const parsed = matter(raw);
    return {
      data: (parsed.data ?? {}) as Record<string, unknown>,
      content: parsed.content ?? '',
    };
  } catch {
    // Malformed frontmatter — treat the whole thing as body.
    return { data: {}, content: raw };
  }
}

export function resolveTitle(
  data: Record<string, unknown>,
  content: string,
  pathHint: string,
): string {
  const t = data['title'];
  if (typeof t === 'string' && t.length > 0) return t;
  const n = data['name'];
  if (typeof n === 'string' && n.length > 0) return n;

  const h1 = /^#[^\S\r\n]+(.+?)[^\S\r\n]*$/m.exec(content);
  if (h1?.[1]) return h1[1];

  return basename(pathHint);
}
