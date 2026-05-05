# Changelog

## 0.1.0-alpha.0 — 2026-05-04

Initial conformance runner:

- 4 universal checks (run on any adapter): `manifest/valid`, `manifest/protocol-compatible`, `ai-friendly/flags`, `docs/llm-md`
- Host functional suite (5 checks): `host/createProject`, `host/setEnv-idempotent`, `host/getEnv-roundtrip`, `host/exportState-importState`, `host/structured-errors`
- Storage functional suite (3 checks): `storage/put-get-delete`, `storage/list-prefix`, `storage/structured-errors`
- Library API: `runSuite(opts)` returns a `SuiteResult` with rolled-up counts
- Bin: `agentry-adapter-test <category> --target <path> [--json] [--universal-only]`
- Categories without a functional suite (db/auth/email/llm/domain/repo/wiki) run universal-only at v0
