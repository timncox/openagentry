# @openagentry/adapter-wiki-fs

Local-filesystem `WikiAdapter` for OpenAgentry. Stores wiki content as plain
markdown + YAML frontmatter on disk. No Obsidian dependency, no proprietary
syntax — `.md` files Obsidian / VS Code / any markdown editor can open.

## Config

```ts
import { createWikiFsAdapter } from '@openagentry/adapter-wiki-fs';

const adapter = createWikiFsAdapter({
  workspaceVaultPath: '/path/to/wiki',          // required
  projectVaultPath: '/path/to/project-wiki',    // optional
  search: { maxResults: 20, snippetLength: 200 },
});
```

The default export reads `OA_WIKI_FS_WORKSPACE_PATH` and optional
`OA_WIKI_FS_PROJECT_PATH` from `process.env`. If `OA_WIKI_FS_WORKSPACE_PATH`
is unset, the default falls back to `os.tmpdir()/agentry-wiki-conformance`
(used only for ungated conformance tests).

## Path convention

Every `path` argument is **relative to the vault root** with an explicit
`workspace/` or `project/` prefix:

- `workspace/decisions/0001-cf-vs-vercel.md` → workspace vault
- `project/runbooks/oncall.md` → project vault
- `decisions/foo.md` (no prefix) → workspace vault (default)

`WikiPage.path` and `WikiHit.path` always include the prefix so consumers
can round-trip them back to `read`.

## Operations

- **`list(scope?)`** — returns `WikiPage[]` (path, scope, title, updatedAt)
  by walking each vault recursively. Title resolution: `frontmatter.title ||
  frontmatter.name || firstH1 || basename`. `scope: 'all'` (default) merges
  workspace + project; `'workspace'` or `'project'` filters.
- **`read(path)`** — returns raw file contents (frontmatter included).
- **`write(path, content)`** — atomic write (temp + rename); auto-creates
  parent dirs. Returns `{path, status, diff?}` where status is `created`,
  `updated`, or `unchanged`. Diff is unified format, populated only on
  `updated`.
- **`append(path, content)`** — appends content with newline separator;
  creates the file if missing.
- **`search(query, scope?)`** — naive case-insensitive substring match
  across body + frontmatter values. Returns top `maxResults` `WikiHit`s
  ranked by occurrence count.

## Error codes

| Code | Phase | Meaning |
|---|---|---|
| `E_WIKI_FS_NOT_FOUND` | `read`, `list`, `search` | Path does not exist |
| `E_WIKI_FS_PERMISSION` | any | Filesystem rejected the operation (EACCES/EPERM) |
| `E_WIKI_FS_PARSE` | any | Unexpected fs error code (mapped fallback) |
| `E_WIKI_FS_SCHEMA` | `init` | Config did not match `wikiFsConfigSchema` |
| `E_WIKI_FS_OUT_OF_VAULT` | any | Path resolved outside the vault root (rejected; security) |
| `E_WIKI_FS_NO_PROJECT_VAULT` | any | `project/` path used but no `projectVaultPath` configured |

All errors are `AgentryError` instances with `adapter: 'wiki-fs'`.

## Vault layout convention

The framework recommends (but does not enforce) this folder structure
inside each vault:

- `decisions/` — architectural decisions (ADRs)
- `runbooks/` — operational procedures
- `integrations/` — third-party API context
- `history/` — incident write-ups, retrospectives

The adapter does not enforce this layout — it walks every `*.md` file
recursively regardless of folder name.

## Path traversal hardening

Every operation passes its path through `resolveSafePath`, which rejects
any input that resolves outside the vault root (`..` segments, absolute
paths to `/etc`, etc.) with `E_WIKI_FS_OUT_OF_VAULT`. This is non-
negotiable for fs adapters — no override flag exists in v0.

## Out of scope (v0)

- `llms.txt` index generation (separate concern)
- FTS / fuzzy search (naive substring only in v0; interface stable for v1 swap)
- Wikilink resolution (`[[name]]` → file path) — Obsidian-specific
- File watching / live refresh (`refresh()` is a no-op)
