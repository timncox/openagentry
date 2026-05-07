# @openagentry/adapter-repo-github

Adapter ID: `repo-github`

## What it does

Manages GitHub repositories via the GitHub REST API v3. Implements `RepoAdapter` from `@openagentry/core`: create, delete, get, and format remote URLs for user-owned and org-owned repositories.

## Env vars

### Required

| Var | Purpose |
|---|---|
| `OA_GITHUB_TOKEN` | GitHub Personal Access Token — classic (`repo` scope) or fine-grained ("Administration: Read and write" + "Metadata: Read-only") |

### Optional

| Var | Purpose |
|---|---|
| `OA_GITHUB_ENDPOINT` | API base URL override for GitHub Enterprise Server (e.g. `https://github.example.com/api/v3`). Defaults to `https://api.github.com`. |

## Operations

| Method | What it does | GitHub endpoint(s) |
|---|---|---|
| `create(opts)` | Creates a repo under a user or org. Probes `GET /user` once per adapter instance to determine owner type; result cached. | `POST /user/repos` or `POST /orgs/{owner}/repos` |
| `delete(repo, confirm)` | Deletes a repo. Requires a non-empty `ConfirmToken`. Not idempotent — throws on missing repo. | `DELETE /repos/{owner}/{name}` |
| `get(owner, name)` | Fetches repo metadata; returns `null` on 404. | `GET /repos/{owner}/{name}` |
| `remoteUrl(repo, mode)` | Formats the git remote URL (no HTTP call). `mode: 'https'` or `'ssh'`. | — |

## Errors

| Code | Meaning | Fix |
|---|---|---|
| `E_GITHUB_AUTH` | Bad, missing, expired, or suspended token | Regenerate PAT; check token expiry and account status |
| `E_GITHUB_NOT_FOUND` | Repo not found (on `delete`; `get` returns `null` instead) | Verify owner/name; use `get` first |
| `E_GITHUB_PERMISSION` | Token lacks scope for the target owner or org | Add `repo` scope (classic) or "Administration: Read and write" (fine-grained) |
| `E_GITHUB_INVALID` | Bad repo name, missing ConfirmToken, name conflict (422), unsupported visibility | Fix input; check GitHub's error message in `context.githubErrorMessage` |
| `E_GITHUB_RATE_LIMIT` | Primary or secondary rate limit hit | Respect `retryAfter` (seconds); adapter does not auto-retry |
| `E_GITHUB_NETWORK` | `fetch`-level failure (DNS, TCP, abort, timeout) | Check network connectivity; retry after backoff |
| `E_GITHUB_UPSTREAM` | HTTP 5xx or unmapped 4xx from GitHub | Transient; retry; report if persistent |

## Gotchas

- **`internal` repos map to `private`.** GitHub Enterprise Server supports `visibility: 'internal'`; the v0 `RepoAdapter` interface only exposes `'public' | 'private'`. Enterprise internal repos are surfaced as `'private'`. This is documented and intentional for v0.
- **`delete` is not idempotent.** Calling `delete` on a repo that does not exist throws `E_GITHUB_NOT_FOUND` (phase `'delete'`). Use `get` first to check existence if idempotency is needed.
- **`delete` requires a non-empty ConfirmToken.** The `ConfirmToken` opaque type requires a non-empty string cast through `as unknown as ConfirmToken`. Passing an empty string throws `E_GITHUB_INVALID` before any network call.
- **First `create` makes an extra `GET /user` request.** The adapter probes `GET /user` on the first `create` call per instance to learn the authenticated login (user owner vs. org owner routing). The result is cached for the lifetime of the adapter instance — subsequent creates do not re-probe.
