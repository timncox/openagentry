# OpenAgentry

> An open-source workspace built for AI agents from the ground up.

This monorepo holds all official `@openagentry/*` packages.

## Status

Alpha. Shipped:
- `@openagentry/core@0.1.0-alpha.1` — public SDK (adapter interfaces, plugin protocol, runtime helpers)
- `@openagentry/cli@0.1.0-alpha.1` — `agentry` binary + library export of dispatcher/registry
- `@openagentry/mcp@0.1.0-alpha.0` — `agentry-mcp` meta-MCP server (every CLI command exposed as an MCP tool)
- `@openagentry/adapter-test-suite@0.1.0-alpha.0` — conformance runner; universal AI-friendliness checks plus host + storage functional suites
- `@openagentry/adapter-host-cloudflare@0.1.0-alpha.0` — first concrete HostAdapter (Cloudflare Pages)
- `@openagentry/adapter-db-neon@0.1.0-alpha.0` — first concrete DatabaseAdapter (Neon Postgres)
- `@openagentry/adapter-auth-nextauth@0.1.0-alpha.0` — first concrete AuthAdapter (next-auth v4)
- `@openagentry/adapter-llm-cli@0.1.0-alpha.0` — operator/CLI flavor `LlmAdapter` shelling out to `claude` / `codex` / `gemini`. No API keys at the adapter level.
- `@openagentry/adapter-wiki-fs@0.1.0-alpha.0` — first concrete `WikiAdapter` (local filesystem, markdown + YAML frontmatter; no Obsidian dep)

## Packages

- [`@openagentry/core`](./packages/core) — adapter interfaces, plugin protocol, runtime helpers
- [`@openagentry/cli`](./packages/cli) — the `agentry` CLI binary + library
- [`@openagentry/mcp`](./packages/mcp) — the `agentry-mcp` meta-MCP server
- [`@openagentry/adapter-test-suite`](./packages/adapter-test-suite) — conformance runner
- [`@openagentry/adapter-host-cloudflare`](./packages/adapter-host-cloudflare) — Cloudflare Pages HostAdapter
- [`@openagentry/adapter-db-neon`](./packages/adapter-db-neon) — Neon Postgres DatabaseAdapter
- [`@openagentry/adapter-auth-nextauth`](./packages/adapter-auth-nextauth) — next-auth v4 AuthAdapter
- [`@openagentry/adapter-llm-cli`](./packages/adapter-llm-cli) — operator/CLI LlmAdapter (`claude` / `codex` / `gemini`)
- [`@openagentry/adapter-wiki-fs`](./packages/adapter-wiki-fs) — local-fs WikiAdapter (markdown + YAML frontmatter)

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

Apache-2.0 unless otherwise noted in package directories.
