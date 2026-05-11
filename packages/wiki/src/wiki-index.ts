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

  search(_query: string, _opts?: SearchOpts): SearchHit[] {
    throw new Error('not implemented yet (Task 6)');
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
