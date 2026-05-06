# Changelog

## 0.1.0-alpha.0 — 2026-05-06

Initial alpha release. First concrete `WikiAdapter` implementation in the
OpenAgentry framework.

- Plain markdown + YAML frontmatter on local filesystem (no Obsidian dep)
- Two-vault model: `workspaceVaultPath` (required) + `projectVaultPath` (optional)
- 5 adapter operations: `list`, `read`, `write`, `append`, `search`
- 3 lifecycle hooks: `init`, `refresh`, `healthcheck`
- 6 stable error codes: `E_WIKI_FS_{NOT_FOUND, PERMISSION, PARSE, SCHEMA, OUT_OF_VAULT, NO_PROJECT_VAULT}`
- Path traversal hardening via `resolveSafePath`
- Atomic writes via temp + rename
- Title resolution: frontmatter.title → frontmatter.name → first H1 → basename
- Naive case-insensitive substring search with snippet + occurrence-count score
- Default export from `OA_WIKI_FS_WORKSPACE_PATH` + `OA_WIKI_FS_PROJECT_PATH` env vars
- Ungated conformance test against `@openagentry/adapter-test-suite`
- 4 universal + 6 wiki functional checks all green

Internal:
- `packages/core` extends `AgentryErrorPhase` with `list`, `read`, `write`,
  `append` (paying off prior plan's deferred follow-up).
- `packages/adapter-test-suite` adds the `wiki` functional suite.
