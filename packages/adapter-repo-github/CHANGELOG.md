# Changelog

## 0.1.0-alpha.0 (2026-05-07)

Initial alpha release.

- Implements all four `RepoAdapter` methods: `create`, `delete`, `get`, `remoteUrl`.
- Backed by the [GitHub REST API v3](https://docs.github.com/en/rest) via plain `fetch` (no Octokit); matches the lightweight approach of Plans K and L.
- Single HTTP chokepoint (`http.ts`) with `githubFetch` — auth headers (`Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`), HTTP status → `AgentryError` translation, and rate-limit `retryAfter` extraction.
- Seven stable error codes: `E_GITHUB_AUTH`, `E_GITHUB_NOT_FOUND`, `E_GITHUB_PERMISSION`, `E_GITHUB_INVALID`, `E_GITHUB_RATE_LIMIT`, `E_GITHUB_NETWORK`, `E_GITHUB_UPSTREAM`.
- Manifest: `category: 'repo'`, `id: 'repo-github'`, `fillsSlots: ['repo']`, `capabilities.ghes: true`, `capabilities.remoteUrlModes: 'https,ssh'`.
- Lazy default export from `OA_GITHUB_TOKEN` (required) + `OA_GITHUB_ENDPOINT` (optional; defaults to `https://api.github.com`). First method call constructs the adapter; required-env errors thrown as `AgentryError({ code: 'E_GITHUB_AUTH', phase: 'init' })`.
- Conforms to `@openagentry/adapter-test-suite@0.1.0-alpha.4` repo suite (universal checks + `repo/structured-errors` always-on; `repo/create-delete-roundtrip` opt-in via `OA_REPO_CONFORMANCE_TEST_OWNER`).
- Supports user-owned repos (`POST /user/repos`) and org-owned repos (`POST /orgs/{owner}/repos`); routing determined by a lazy `GET /user` probe cached per adapter instance.
- GitHub Enterprise Server support via `OA_GITHUB_ENDPOINT`; `remoteUrl()` derives the base host from the endpoint for correct HTTPS and SSH URL generation.

Spec: `/Users/timcox/tim-os/docs/superpowers/specs/2026-05-07-openagentry-adapter-repo-github-design.md`
