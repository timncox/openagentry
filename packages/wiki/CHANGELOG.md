# Changelog

## 0.1.0-alpha.0 (unreleased)

Initial release. In-memory indexer over the `WikiAdapter` contract.

- `WikiIndex.build()` — walks the adapter, parses frontmatter + links, builds the index
- `WikiIndex.refresh()` — full rebuild
- `WikiIndex.search(query, opts?)` — title-boosted substring search with snippet
- `WikiIndex.byTitle(title, scope?)` — exact title lookup, case-insensitive
- `WikiIndex.byTag(tag, scope?)` — frontmatter `tags` lookup (string or array)
- `WikiIndex.forwardLinks(path)` — `[[wikilinks]]` (resolved by title) + relative-path links
- `WikiIndex.backlinks(path)` — every page whose forwardLinks include this path
- Helpers: `extractFrontmatter` (gray-matter wrapper), `extractLinks` (regex-based)
- Tests use an in-tree `FakeWikiAdapter` — no filesystem touch
