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

Plan F (`@openagentry/adapter-db-neon` — first concrete DatabaseAdapter) is next.

## Packages

- [`@openagentry/core`](./packages/core) — adapter interfaces, plugin protocol, runtime helpers
- [`@openagentry/cli`](./packages/cli) — the `agentry` CLI binary + library
- [`@openagentry/mcp`](./packages/mcp) — the `agentry-mcp` meta-MCP server
- [`@openagentry/adapter-test-suite`](./packages/adapter-test-suite) — conformance runner
- [`@openagentry/adapter-host-cloudflare`](./packages/adapter-host-cloudflare) — Cloudflare Pages HostAdapter

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

Apache-2.0 unless otherwise noted in package directories.
