# @openagentry/wiki

Search, frontmatter/tag lookup, and a backlinks graph over any
[`WikiAdapter`](https://github.com/timncox/openagentry/blob/main/packages/core/src/adapters/wiki.ts).

Composes the primitive adapter operations (`list`, `read`) into a higher-level
in-memory index that an LLM agent can query at runtime.

## Install

```bash
pnpm add @openagentry/wiki @openagentry/adapter-wiki-fs
```

## Use

```ts
import { WikiIndex } from '@openagentry/wiki';
import wiki from '@openagentry/adapter-wiki-fs';

const index = new WikiIndex(wiki);
await index.build();

// Title-boosted substring search
const hits = index.search('cloudflare', { limit: 5 });

// Lookup by metadata
const hostPages = index.byTag('host');
const cfPages = index.byTitle('Cloudflare');

// Link graph
const linksToCloudflare = index.backlinks('workspace/cloudflare.md');
const linksFromHub = index.forwardLinks('workspace/hub.md');

// Refresh after writes
await index.refresh();
```

## Scope (v0)

- In-memory index. No disk persistence.
- Substring search with title-boosted scoring (3× / 2× / 1× for title /
  frontmatter / body matches).
- Two link styles: `[[Wikilinks]]` (Obsidian) and `[label](./relative.md)`
  (CommonMark with relative paths).
- Full rebuild on `refresh()`. No incremental updates, no file watching.
- No semantic search, no markdown rendering.

## License

Apache-2.0
