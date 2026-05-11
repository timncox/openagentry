import type { WikiAdapter, WikiScope } from '@openagentry/core';
import { extractFrontmatter } from './frontmatter.js';
import { extractLinks } from './links.js';
import type { IndexedPage, SearchHit, SearchOpts } from './types.js';

export class WikiIndex {
  private readonly adapter: WikiAdapter;
  private pages = new Map<string, IndexedPage>();

  constructor(adapter: WikiAdapter) {
    this.adapter = adapter;
  }

  get size(): number {
    return this.pages.size;
  }

  get(path: string): IndexedPage | undefined {
    return this.pages.get(path);
  }

  /** Walk the underlying adapter and build the index from scratch. */
  async build(): Promise<void> {
    this.pages.clear();
    const pages = await this.adapter.list('all');
    await Promise.all(
      pages.map(async (p) => {
        const raw = await this.adapter.read(p.path);
        const { data: frontmatter, body } = extractFrontmatter(raw);
        const { wikilinks, paths: relativePaths } = extractLinks(body);
        this.pages.set(p.path, {
          ...p,
          frontmatter,
          body,
          wikilinks,
          relativePaths,
        });
      }),
    );
  }

  // --- Stubs implemented in later tasks ---

  search(query: string, opts?: SearchOpts): SearchHit[] {
    const limit = opts?.limit ?? 25;
    const scope = opts?.scope ?? 'all';
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];

    const out: SearchHit[] = [];
    for (const page of this.pages.values()) {
      if (scope !== 'all' && page.scope !== scope) continue;

      let score = 0;
      if (page.title.toLowerCase().includes(needle)) score += 3;

      for (const v of Object.values(page.frontmatter)) {
        if (typeof v === 'string' && v.toLowerCase().includes(needle)) {
          score += 2;
          break;
        }
      }

      const bodyLower = page.body.toLowerCase();
      const bodyIdx = bodyLower.indexOf(needle);
      if (bodyIdx !== -1) score += 1;

      if (score === 0) continue;

      const snippet = makeSnippet(page.body, bodyIdx);
      out.push({
        path: page.path,
        scope: page.scope,
        title: page.title,
        snippet,
        score,
      });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }
  byTitle(_title: string, _scope?: WikiScope): IndexedPage[] {
    throw new Error('not implemented yet (Task 7)');
  }
  byTag(_tag: string, _scope?: WikiScope): IndexedPage[] {
    throw new Error('not implemented yet (Task 7)');
  }
  backlinks(_path: string): IndexedPage[] {
    throw new Error('not implemented yet (Task 8)');
  }
  forwardLinks(_path: string): IndexedPage[] {
    throw new Error('not implemented yet (Task 8)');
  }
  refresh(): Promise<void> {
    throw new Error('not implemented yet (Task 9)');
  }
}

/** Build a ≤160-char snippet centred on a body match (or the first 160 chars). */
function makeSnippet(body: string, matchIdx: number): string {
  const window = 160;
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (matchIdx === -1) return collapsed.slice(0, window);
  const start = Math.max(0, matchIdx - 60);
  const end = Math.min(collapsed.length, start + window);
  const slice = collapsed.slice(start, end);
  return (start > 0 ? '…' : '') + slice + (end < collapsed.length ? '…' : '');
}
