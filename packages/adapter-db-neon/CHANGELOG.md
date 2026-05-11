# Changelog

## 0.1.0-alpha.1 — 2026-05-08

- **Default export converted to the lazy-default pattern** (matches
  `adapter-host-vercel`, `adapter-repo-github`, etc.). The default is now
  always a frozen `DatabaseAdapter` shape with static `category: 'db'` + `id:
  'neon'`. Async methods read `NEON_API_KEY` on first call and cache the
  result; missing env produces an `AgentryError` with code `E_NEON_AUTH` at
  the use-site (rather than the import returning `null`). Direct importers no
  longer have to null-check `import db from '@openagentry/adapter-db-neon'`.

## 0.1.0-alpha.0 (unreleased)

Initial release. First concrete `DatabaseAdapter` for OpenAgentry, backed by Neon Postgres.

- All five `DatabaseAdapter` methods: `createInstance`, `destroyInstance`, `connectionString`, `exportState`, `importState`
- Lifecycle hooks: `init`, `auth`, `healthcheck`, `refresh`
- Idempotent operations: `createInstance` (find-by-slug fallback) and `importState` (find-or-create)
- Maps Neon project + branches to OpenAgentry instances + envs (prod=`main`, preview/dev are optional branches via `perEnvBranches`)
- Stable error codes: `E_NEON_AUTH`, `E_NEON_NOT_FOUND`, `E_NEON_RATE_LIMITED`, `E_NEON_HTTP`, `E_NEON_NETWORK`, `E_NEON_SCHEMA`, `E_NEON_API`
- Passes `@openagentry/adapter-test-suite db` against a real Neon account when `NEON_API_KEY` is present
- snapshotRef is a vendor marker (`neon:project:<id>:as-of:<iso>`); real backup/restore deferred to v1
