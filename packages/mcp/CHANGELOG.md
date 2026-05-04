# Changelog

## 0.1.0-alpha.0 — 2026-05-04

Initial meta-MCP server:

- Bin entry `agentry-mcp` over stdio transport (CJS with `#!/usr/bin/env node` shebang)
- One MCP tool per registered cli command (`agentry_version`, `agentry_help`, `agentry_doctor`, `agentry_list`, `agentry_capabilities`)
- Tool input schema accepts `args: string[]` (CLI argv tail); dispatcher always runs in `--json` mode
- `AgentryError`-aware error reporting (isError + structured payload)
- End-to-end integration test using the @modelcontextprotocol/sdk Client driving the spawned binary
- Depends on `@openagentry/cli@0.1.0-alpha.1` (library export) and `@modelcontextprotocol/sdk@^1.0.0`
