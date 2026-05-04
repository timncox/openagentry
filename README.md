# OpenAgentry

> An open-source workspace built for AI agents from the ground up.

This monorepo holds all official `@openagentry/*` packages.

## Status

Alpha. Shipped:
- `@openagentry/core@0.1.0-alpha.1` — public SDK (adapter interfaces, plugin protocol, runtime helpers)
- `@openagentry/cli@0.1.0-alpha.1` — `agentry` binary + library export of dispatcher/registry
- `@openagentry/mcp@0.1.0-alpha.0` — `agentry-mcp` meta-MCP server (every CLI command exposed as an MCP tool)

Plan D (`@openagentry/adapter-test-suite` — conformance runner) is next.

## Packages

- [`@openagentry/core`](./packages/core) — adapter interfaces, plugin protocol, runtime helpers
- [`@openagentry/cli`](./packages/cli) — the `agentry` CLI binary + library
- [`@openagentry/mcp`](./packages/mcp) — the `agentry-mcp` meta-MCP server

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

Apache-2.0 unless otherwise noted in package directories.
