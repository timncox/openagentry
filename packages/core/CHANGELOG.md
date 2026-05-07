# Changelog

## 0.1.0-alpha.2 (2026-05-06)

- Add `'send'` to `AgentryErrorPhase` union for email adapters.

## 0.1.0-alpha.1 — 2026-05-04

Pre-publish polish on top of alpha.0.

- **Breaking:** `RepoAdapter.delete(repo, confirm: ConfirmToken)` now requires a confirm token (consistent with `HostAdapter.destroyProject` and `DatabaseAdapter.destroyInstance`).
- Manifest `protocolVersion` regex broadened to match `parseProtocolRange` (`"1"`, `"^1"`, `">=1"`); the previous schema rejected the caret/`>=` forms even though the parser accepted them.
- `AdapterContext` JSDoc clarified — protocol v1 has no lifecycle hooks; the type is reserved for the next protocol revision and adapters that consume it internally.
- `AdapterId` JSDoc notes its forward-looking role (used by future loader/registry code, not by `@openagentry/core` itself).
- `LICENSE` and `CHANGELOG.md` now ship inside the npm tarball; `README.md` license link points at the bundled `./LICENSE`.
- README clarifies which adapter categories ship with interfaces (9) versus reserved-for-later manifest values (`kv`, `cron`, `billing`, `push`).

## 0.1.0-alpha.0 — 2026-05-04

Initial draft. Public SDK contract:

- Adapter interfaces: HostAdapter, DatabaseAdapter, AuthAdapter, EmailAdapter,
  LlmAdapter, StorageAdapter, DomainAdapter, RepoAdapter, WikiAdapter
- Plugin protocol: manifest schema (zod), version helpers
- Runtime: AgentryError, registerAdapter, useAdapter, AdapterContext
