# @openagentry/wiki — for LLMs

You are looking at the in-memory wiki indexer. It composes any `WikiAdapter` (today: `@openagentry/adapter-wiki-fs`) into a queryable index. **It does not write to the wiki** — writes go through the adapter directly. Call `refresh()` after writes to update the index.

## When to use this package

- The user wants RANKED search results (not just substring hits).
- The user wants to enumerate pages by tag or title.
- The user wants the link graph (what links to / from a page).

## When NOT to use it

- One-off page reads → call `wiki.read(path)` on the adapter directly.
- One-off page writes → call `wiki.write(path, content)` on the adapter directly.
- Long-running watch / sync — out of scope; do a full rebuild via `refresh()`.

## Surface

```ts
class WikiIndex {
  constructor(adapter: WikiAdapter);
  readonly size: number;
  get(path: string): IndexedPage | undefined;
  build(): Promise<void>;
  refresh(): Promise<void>;
  search(query: string, opts?: { limit?: number; scope?: WikiScope }): SearchHit[];
  byTitle(title: string, scope?: WikiScope): IndexedPage[];
  byTag(tag: string, scope?: WikiScope): IndexedPage[];
  forwardLinks(sourcePath: string): IndexedPage[];
  backlinks(targetPath: string): IndexedPage[];
}
```

## Common gotchas

- `build()` must be called before any query method or the index is empty.
- `WikiIndex` does not subscribe to changes — call `refresh()` after writes.
- Wikilinks are resolved by **title**, case-insensitive. Two pages with the same title both resolve as forward-link targets.
- Relative paths in markdown links are resolved POSIX-style against the linking page's directory. `..` works; absolute paths do not.
- Tag matching: `tags: foo` and `tags: [foo]` both match `byTag('foo')`. Other shapes are ignored.
