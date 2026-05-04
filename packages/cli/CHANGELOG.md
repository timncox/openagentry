# Changelog

## 0.1.0-alpha.0 — 2026-05-04

Initial CLI skeleton:

- Dispatcher with hand-rolled argv parser, `--json` mode, structured AgentryError handling
- Config readers/writers for `~/.agentry/config.json` and `<workspace>/.agentry/workspace.json`
- Plugin loader: resolves from workspace `node_modules`, validates manifest via `@openagentry/core.validateManifest`, registers adapters
- Commands: `version`, `help`, `doctor`, `list`, `capabilities`
- Bin entry `agentry` (CJS with `#!/usr/bin/env node` shebang)
