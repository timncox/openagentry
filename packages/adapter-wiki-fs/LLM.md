# @openagentry/adapter-wiki-fs

First concrete `WikiAdapter` implementation for OpenAgentry. Stores wiki content
as plain markdown plus YAML frontmatter on the local filesystem. No Obsidian
dependency, no proprietary syntax — `.md` files that any markdown editor can open.

## Configuration

The adapter accepts a config object with `workspaceVaultPath` (required) and
optional `projectVaultPath`. Both must be absolute or resolvable paths. The
default export reads `OA_WIKI_FS_WORKSPACE_PATH` and optional
`OA_WIKI_FS_PROJECT_PATH` from `process.env`.

## Operations

The adapter implements the `WikiAdapter` interface from `@openagentry/core`.
- `list(scope?)` — returns `WikiPage[]` from one or both vaults
- `read(path)` — returns raw file contents including frontmatter
- `write(path, content)` — atomic write with unified diff on update
- `append(path, content)` — appends content with newline separator
- `search(query, scope?)` — naive case-insensitive substring search

Path convention: prefix paths with `workspace/` or `project/` to route to the
right vault. Unprefixed paths default to workspace.

## Error codes

Six stable error codes: `E_WIKI_FS_NOT_FOUND`, `E_WIKI_FS_PERMISSION`,
`E_WIKI_FS_PARSE`, `E_WIKI_FS_SCHEMA`, `E_WIKI_FS_OUT_OF_VAULT`, and
`E_WIKI_FS_NO_PROJECT_VAULT`. All errors are `AgentryError` instances with
`adapter: 'wiki-fs'`.

Task 17 will expand this with detailed examples.
