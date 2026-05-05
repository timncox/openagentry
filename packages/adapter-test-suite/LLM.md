# @openagentry/adapter-test-suite (LLM context)

Conformance runner for OpenAgentry adapters. Use this to verify any adapter package passes the universal AI-friendliness checks plus its category functional suite (where one exists).

## Operations

- `runSuite({ target, category?, universalOnly? })` — programmatic entry; resolves a `SuiteResult { passed, failed, skipped, total, checks }`.
- `agentry-adapter-test <category> --target <path>` — bin entry; prints text or `--json` report and exits 0 (all pass) or 1 (any fail).
- `--universal-only` skips the category functional suite even when one is registered.

## Categories with functional suites at v0

`host`, `storage`. Other categories run only the four universal checks.

## Common pitfalls

- `target` must be an absolute path to a directory containing `package.json` with an `openagentry` manifest block plus a built entry (e.g. `dist/index.cjs`) that default-exports the adapter object.
- The adapter's `package.json.openagentry.category` must match the `<category>` argument to the CLI; mismatch aborts the suite with `AgentryError(E_CATEGORY_MISMATCH)` before any checks run.
- LLM.md must be <= 1024 tokens (heuristic: text length / 4) and contain at least two `## H2` sections — including one named like `Operations` / `Key exports` and one like `Common pitfalls` / `Errors`.
- All adapter ops must throw `AgentryError` (not plain `Error`) on failure — functional suites assert this on a documented bad-input path.
