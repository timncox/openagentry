# Changelog

## 0.1.0-alpha.3 — 2026-05-08

Wide-load testing surfaced one more loader edge case:

- **Plugin loader now distinguishes "missing/bad export" from "explicitly null
  default".** Some adapters (`adapter-db-neon`, `adapter-host-cloudflare`)
  intentionally export `default: null` when their required env vars aren't set,
  so the package can be imported safely without crashing. The previous loader
  raised `E_PLUGIN_BAD_EXPORT` on these — the new behaviour is to skip
  registration silently (the manifest still drives `capabilities` reporting).
  Lazy-default-pattern adapters are unaffected.

## 0.1.0-alpha.2 — 2026-05-08

Demo-surfaced bug fixes (openagentry-demo, 2026-05-07):

- **Add `agentry init`** — creates `.agentry/workspace.json` with optional plugin
  positionals (`agentry init @openagentry/adapter-llm-cli ...`), refuses to
  overwrite without `--force`. The `doctor`/`list`/`capabilities` text output
  used to reference this command before it existed.
- **Fix `agentry --version` / `agentry version` reporting `0.0.0`** — published
  layout puts `package.json` one directory up from `dist/cli.cjs`, but the path
  candidates assumed two/three. Now tries the dist layout first, validates the
  package name, and falls back to the test/src layout.
- **Fix `agentry capabilities` reporting phantom `loadErrors`** — Node's
  CJS-ESM dynamic import wraps the entire CommonJS exports object as
  `mod.default`, so tsup-bundled adapters appeared at `mod.default.default`.
  The plugin loader now unwraps the double-default before validating shape.

## 0.1.0-alpha.1 — 2026-05-04

- Add library export at the package root (`main`/`module`/`exports`):
  - `dispatch`, `DispatchOptions`, `parseArgs`, `ParsedArgs`, `FlagValue`
  - `commands`, `registerCommand`, `getCommand`
  - `defineCommand`, `Command`, `CommandContext`
  - `Output`, `OutputOptions`
- Build now emits both `dist/cli.cjs` (bin, with shebang) AND `dist/lib.{js,cjs,d.ts}` (library)
- Bin behavior unchanged

## 0.1.0-alpha.0 — 2026-05-04

Initial CLI skeleton:

- Dispatcher with hand-rolled argv parser, `--json` mode, structured AgentryError handling
- Config readers/writers for `~/.agentry/config.json` and `<workspace>/.agentry/workspace.json`
- Plugin loader: resolves from workspace `node_modules`, validates manifest via `@openagentry/core.validateManifest`, registers adapters
- Commands: `version`, `help`, `doctor`, `list`, `capabilities`
- Bin entry `agentry` (CJS with `#!/usr/bin/env node` shebang)
