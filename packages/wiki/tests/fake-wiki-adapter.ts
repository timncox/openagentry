import type {
  WikiAdapter,
  WikiHit,
  WikiPage,
  WikiScope,
  WikiWriteResult,
} from '@openagentry/core';

interface SeedPage {
  path: string;
  scope: 'workspace' | 'project';
  title: string;
  content: string;
  updatedAt?: string;
}

/**
 * In-memory WikiAdapter for tests. Fully synchronous under the hood; methods
 * return resolved promises to satisfy the async interface. NOT a faithful
 * implementation of `search` (the WikiIndex is what we're testing — the
 * adapter's own `search` is irrelevant here).
 */
export class FakeWikiAdapter implements WikiAdapter {
  readonly category = 'wiki' as const;
  readonly id = 'fake';
  private pages = new Map<string, { page: WikiPage; content: string }>();

  constructor(seed: SeedPage[] = []) {
    for (const p of seed) this.put(p);
  }

  put(p: SeedPage): void {
    const updatedAt = p.updatedAt ?? '2026-05-11T00:00:00.000Z';
    this.pages.set(p.path, {
      page: { path: p.path, scope: p.scope, title: p.title, updatedAt },
      content: p.content,
    });
  }

  delete(path: string): void {
    this.pages.delete(path);
  }

  async list(scope: WikiScope = 'all'): Promise<WikiPage[]> {
    return [...this.pages.values()]
      .map((e) => e.page)
      .filter((p) => scope === 'all' || p.scope === scope);
  }

  async read(path: string): Promise<string> {
    const entry = this.pages.get(path);
    if (entry === undefined) throw new Error(`fake-wiki: not found: ${path}`);
    return entry.content;
  }

  async search(_query: string, _scope: WikiScope = 'all'): Promise<WikiHit[]> {
    return []; // not exercised by our index tests
  }

  async write(_path: string, _content: string): Promise<WikiWriteResult> {
    throw new Error('fake-wiki: write not implemented for index tests');
  }

  async append(_path: string, _content: string): Promise<WikiWriteResult> {
    throw new Error('fake-wiki: append not implemented for index tests');
  }
}
