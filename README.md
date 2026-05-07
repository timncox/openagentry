# OpenAgentry

> An open-source workspace built for AI agents from the ground up.

This monorepo holds all official `@openagentry/*` packages.

## Status

Alpha. Shipped:
- `@openagentry/core@0.1.0-alpha.2` — public SDK (adapter interfaces, plugin protocol, runtime helpers)
- `@openagentry/cli@0.1.0-alpha.1` — `agentry` binary + library export of dispatcher/registry
- `@openagentry/mcp@0.1.0-alpha.0` — `agentry-mcp` meta-MCP server (every CLI command exposed as an MCP tool)
- `@openagentry/adapter-test-suite@0.1.0-alpha.4` — conformance runner; universal AI-friendliness checks plus host + storage + email + domain + repo functional suites
- `@openagentry/adapter-host-cloudflare@0.1.0-alpha.0` — first concrete HostAdapter (Cloudflare Pages)
- `@openagentry/adapter-db-neon@0.1.0-alpha.0` — first concrete DatabaseAdapter (Neon Postgres)
- `@openagentry/adapter-auth-nextauth@0.1.0-alpha.0` — first concrete AuthAdapter (next-auth v4)
- `@openagentry/adapter-llm-cli@0.1.0-alpha.0` — operator/CLI flavor `LlmAdapter` shelling out to `claude` / `codex` / `gemini`. No API keys at the adapter level.
- `@openagentry/adapter-wiki-fs@0.1.0-alpha.0` — first concrete `WikiAdapter` (local filesystem, markdown + YAML frontmatter; no Obsidian dep)
- `@openagentry/adapter-storage-r2@0.1.0-alpha.0` — first concrete `StorageAdapter` (Cloudflare R2 via S3-compatible API + aws4fetch)
- `@openagentry/adapter-email-resend@0.1.0-alpha.0` — first concrete `EmailAdapter` (Resend); 77 tests, five stable error codes
- `@openagentry/adapter-domain-namecheap@0.1.0-alpha.0` — first concrete `DomainAdapter` (Namecheap XML API); 1,427 tests total across 12 packages; seven stable error codes
- `@openagentry/adapter-repo-github@0.1.0-alpha.0` — first concrete `RepoAdapter` (GitHub REST API); 1,628 tests total across 13 packages; seven stable error codes
- `@openagentry/adapter-host-vercel@0.1.0-alpha.0` — second concrete `HostAdapter` (Vercel REST API); proves swappability of the host abstraction; 1,860 tests total across 14 packages

14 packages, 1,860 tests total.

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
- [`@openagentry/adapter-storage-r2`](./packages/adapter-storage-r2) — Cloudflare R2 StorageAdapter (S3-compatible)
- [`@openagentry/adapter-email-resend`](./packages/adapter-email-resend) — Resend EmailAdapter
- [`@openagentry/adapter-domain-namecheap`](./packages/adapter-domain-namecheap) — Namecheap DomainAdapter (XML API)
- [`@openagentry/adapter-repo-github`](./packages/adapter-repo-github) — GitHub RepoAdapter (REST API)
- [`@openagentry/adapter-host-vercel`](./packages/adapter-host-vercel) — Vercel HostAdapter (REST API)

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

Apache-2.0 unless otherwise noted in package directories.
