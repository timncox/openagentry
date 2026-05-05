# @openagentry/adapter-host-cloudflare (LLM context)

OpenAgentry `HostAdapter` implementation backed by **Cloudflare Pages**.

## Public API

- `createCloudflareHostAdapter({ apiToken, accountId, apiBase?, fetch? })` —
  returns a fully-typed `HostAdapter` object. `apiToken` must have the
  `Pages:Edit` + `Account:Read` permissions.
- `default export` — same adapter, constructed from
  `process.env.CLOUDFLARE_API_TOKEN` + `process.env.CLOUDFLARE_ACCOUNT_ID`
  if both are present; `null` otherwise. The `@openagentry/adapter-test-suite`
  conformance runner picks this up.

## Behaviors and constraints

- **Env vars are stored as Cloudflare Pages `plain_text` configuration** — they
  round-trip through `setEnv`/`getEnv` but are **NOT secrets**. A future
  `secrets` adapter will provide encrypted storage. Do not put credentials
  through `setEnv` at v0.
- **`Env` mapping**: `'preview'` → Cloudflare `preview`, `'prod'` →
  `production`. `'dev'` is rejected with `AgentryError(E_CF_HTTP)` —
  Cloudflare Pages has no local-dev concept.
- **Idempotent operations** (matches manifest): `createProject` returns the
  existing project if a duplicate name is reported; `setEnv` merges into
  current state; `attachDomain` returns the existing domain on duplicate;
  `importState` finds-then-creates.
- **`deploy` requires `meta.srcDir`** on the `HostProject` — set it via
  `createProject({ ..., meta: { srcDir: '/abs/path' } })` or attach it
  directly. Direct Upload flow: build sha256 manifest → upload-token →
  assets/upsert → create deployment.
- **`logs(p, { tail: true })`** polls the history endpoint at 2 s intervals.
  Cloudflare Pages does not expose a native push stream; this is the
  best-effort live view at v0.
- **All failures throw `AgentryError`** with stable codes: `E_CF_AUTH`,
  `E_CF_NOT_FOUND`, `E_CF_RATE_LIMITED`, `E_CF_HTTP`, `E_CF_NETWORK`,
  `E_CF_SCHEMA`, `E_CF_PAGES_API`. Each has a `phase` matching the adapter
  method that failed and an optional `suggestedFix` for recoverable errors.

## Common pitfalls

- API token missing the `Pages:Edit` permission → `E_CF_AUTH` with a
  `suggestedFix` pointing at the Cloudflare token-creation docs.
- Trying to use a `dev` env → `E_CF_HTTP` with explicit "use preview or prod".
- `deploy` called on a `HostProject` constructed without `meta.srcDir` →
  `E_CF_HTTP` with "pass meta.srcDir into createProject".
- Re-deploying with the same files: Cloudflare server-side dedupes by hash,
  so the upsert call is cheap; no client-side caching needed at v0.

## Conformance

Run the live integration test with real credentials:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  pnpm --filter @openagentry/adapter-host-cloudflare test:integration
```

The integration test creates a real Pages project named
`oa-conformance-probe-<timestamp>`, sets a probe env var, exports + imports,
and (optionally) cleans up. If the probe project lingers, delete it via the
Cloudflare dashboard.
