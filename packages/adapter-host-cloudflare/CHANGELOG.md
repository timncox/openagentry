# Changelog

## 0.1.0-alpha.0 (unreleased)

Initial release. First concrete `HostAdapter` for OpenAgentry, backed by Cloudflare Pages.

- All eleven `HostAdapter` methods: `createProject`, `destroyProject`, `deploy`, `rollback`, `setEnv`, `getEnv`, `attachDomain`, `detachDomain`, `logs`, `exportState`, `importState`
- Lifecycle hooks: `init`, `auth`, `healthcheck`, `refresh`
- Passes `@openagentry/adapter-test-suite host` against a real Cloudflare account when `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` are present
- Env vars stored as Cloudflare Pages `plain_text` configuration; true secret storage deferred (see `LLM.md`)
- Direct Upload-based deployments from a local `srcDir` configured via `CreateProjectOpts.meta`
