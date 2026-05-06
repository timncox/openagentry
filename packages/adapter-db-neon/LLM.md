# @openagentry/adapter-db-neon (LLM context)

OpenAgentry `DatabaseAdapter` implementation backed by **Neon Postgres**.

## Public API

- `createNeonDatabaseAdapter({ apiKey, apiBase?, defaultRegion?, fetch? })`
  — returns a fully-typed `DatabaseAdapter`. `apiKey` is a Neon personal API
  key (https://neon.tech/docs/manage/api-keys) with project-create scope.
- `default export` — same adapter, constructed from
  `process.env.NEON_API_KEY` if non-empty; `null` otherwise.
  `@openagentry/adapter-test-suite` resolves this default at conformance.

## Behaviors and constraints

- **Engine is fixed to `"postgres"`.** `createInstance({ engine })` rejects
  any other value with `AgentryError(E_NEON_SCHEMA)` and a `suggestedFix`
  pointing at `engine: "postgres"`.
- **Env mapping**: `prod` → Neon branch `main` (default), `preview` → branch
  `preview`, `dev` → branch `dev`. The non-`prod` branches exist only when
  `createInstance` was called with `perEnvBranches: true`. `connectionString`
  for an env whose branch doesn't exist returns `E_NEON_NOT_FOUND` with a
  `suggestedFix` mentioning `perEnvBranches`.
- **Idempotent operations** (matches manifest): `createInstance` returns the
  existing project if a Neon project with the slug-tagged name already
  exists; `importState` finds-then-creates by slug.
- **Project naming**: the Neon project name is `oa-<slug>` (e.g.,
  `conformance-probe` becomes `oa-conformance-probe`). This namespacing
  prevents collisions with non-OpenAgentry projects in the same Neon
  account.
- **`snapshotRef` is a vendor marker, not a fetchable URL.** Format:
  `neon:project:<id>:as-of:<iso>`. Real backup/restore is deferred to v1.
  `importState` ignores `snapshotRef` and only uses `bundle.instance.slug`.
- **Connection strings are fetched fresh per call** from
  `/projects/{id}/connection_uri` and never cached. The returned URI
  includes credentials — treat as secret.
- **All failures throw `AgentryError`** with stable codes: `E_NEON_AUTH`,
  `E_NEON_NOT_FOUND`, `E_NEON_RATE_LIMITED`, `E_NEON_HTTP`, `E_NEON_NETWORK`,
  `E_NEON_SCHEMA`, `E_NEON_API`. Each has a `phase` matching the adapter
  method that failed and an optional `suggestedFix` for recoverable errors.

## Common pitfalls

- API key missing project-create scope → `E_NEON_AUTH` with a `suggestedFix`
  linking to the Neon API-keys docs.
- Calling `connectionString(inst, 'preview')` on an instance created without
  `perEnvBranches: true` → `E_NEON_NOT_FOUND` with explicit "pass
  perEnvBranches: true" hint.
- Passing `engine: "mysql"` (or any non-`postgres` value) → `E_NEON_SCHEMA`
  immediately, no API call made.
- `destroyInstance(inst, "")` → `E_NEON_SCHEMA` immediately. Pass any
  non-empty string as the ConfirmToken.

## Conformance

```bash
NEON_API_KEY=neon_... \
  pnpm --filter @openagentry/adapter-db-neon test:integration
```

The integration test creates a real Neon project named
`oa-conformance-probe` (idempotent — re-runs reuse it), runs the universal
+ db functional checks, and leaves the project in place for inspection. If
the probe project lingers, delete it via the Neon console.
