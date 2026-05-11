# Changelog

## 0.1.0-alpha.1 — 2026-05-08

- **Default export converted to the lazy-default pattern** (matches
  `adapter-host-vercel`, `adapter-repo-github`, etc.). The default is now
  always a frozen `HostAdapter` shape with static `category: 'host'` + `id:
  'host-cloudflare'`. Async methods read `CLOUDFLARE_API_TOKEN` +
  `CLOUDFLARE_ACCOUNT_ID` on first call and cache the result; missing env
  produces an `AgentryError` with code `E_CF_AUTH` at the use-site (rather
  than the import returning `null`). `logs` (AsyncIterable) returns a
  rejecting iterator on missing env. Direct importers no longer have to
  null-check `import host from '@openagentry/adapter-host-cloudflare'`.

## 0.1.0-alpha.0 (unreleased)

Initial release. First concrete `HostAdapter` for OpenAgentry, backed by Cloudflare Pages.

- All eleven `HostAdapter` methods: `createProject`, `destroyProject`, `deploy`, `rollback`, `setEnv`, `getEnv`, `attachDomain`, `detachDomain`, `logs`, `exportState`, `importState`
- Lifecycle hooks: `init`, `auth`, `healthcheck`, `refresh`
- Passes `@openagentry/adapter-test-suite host` against a real Cloudflare account when `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` are present
- Env vars stored as Cloudflare Pages `plain_text` configuration; true secret storage deferred (see `LLM.md`)
- Direct Upload-based deployments from a local `srcDir` configured via `CreateProjectOpts.meta`
