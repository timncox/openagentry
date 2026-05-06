# @openagentry/adapter-wiki-fs

Local-filesystem `WikiAdapter` for OpenAgentry. Plain markdown + YAML
frontmatter on disk — no Obsidian dependency, no proprietary syntax.

## Install

```bash
pnpm add @openagentry/adapter-wiki-fs
```

## Quickstart

```ts
import { createWikiFsAdapter } from '@openagentry/adapter-wiki-fs';

const adapter = createWikiFsAdapter({
  workspaceVaultPath: './wiki',
});

await adapter.write('workspace/decisions/0001-cf-vs-vercel.md', '# Cloudflare\n...');
const pages = await adapter.list();
const hits = await adapter.search('cloudflare');
```

See [LLM.md](./LLM.md) for the full operation reference, error codes, and
path convention.

## License

Apache-2.0
