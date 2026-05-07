# Changelog

## 0.1.0-alpha.0 (unreleased)

Initial release. Second concrete `HostAdapter` for OpenAgentry — proves swappability of the host abstraction alongside `adapter-host-cloudflare`.

- All eleven `HostAdapter` methods: `createProject`, `destroyProject`, `deploy`, `rollback`, `setEnv`, `getEnv`, `attachDomain`, `detachDomain`, `logs`, `exportState`, `importState`
- `createVercelHostAdapter(config)` factory with Zod-validated config; lazy default export bootstraps from `OA_VERCEL_TOKEN` / `OA_VERCEL_TEAM_ID` env vars
- `vercelFetch` chokepoint with Bearer auth, `?teamId=` scoping, JSON body handling, HTTP → `AgentryError` mapping, and `retryAfter` on 429
- Deploy via Vercel git-source (`POST /v13/deployments`); rollback via alias-promote (`POST /v10/projects/{id}/promote/{deploymentId}`)
- Idempotent `setEnv`: POST for new vars, PATCH for existing; `getEnv` filters by target scope array
- `logs` returns an `AsyncIterable<LogEntry>`; tail mode polls with dedup via in-memory `seenIds`
- `exportState` snapshots all env scopes + custom domains; `importState` recreates the project on a fresh account
- Seven stable error codes: `E_VERCEL_AUTH`, `E_VERCEL_NOT_FOUND`, `E_VERCEL_PERMISSION`, `E_VERCEL_INVALID`, `E_VERCEL_RATE_LIMIT`, `E_VERCEL_NETWORK`, `E_VERCEL_UPSTREAM`; plus `E_VERCEL_NO_GIT_LINK` and `E_VERCEL_BAD_STATE` for deploy/import guards
- 232 tests: unit + MSW-mocked conformance against `@openagentry/adapter-test-suite host` suite; gated integration test for real Vercel API
- No changes to `@openagentry/core` or `@openagentry/adapter-test-suite`
