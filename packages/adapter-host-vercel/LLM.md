# @openagentry/adapter-host-vercel

Adapter ID: `host-vercel`

## What it does

Hosts web projects on Vercel via the Vercel REST API. Implements all 11 `HostAdapter` methods from `@openagentry/core`: git-source deploys, alias-swap rollback, env var management across preview/prod/dev scopes, custom domain attachment, log streaming, and full state export/import for project portability.

## Env vars

### Required

| Var | Purpose |
|---|---|
| `OA_VERCEL_TOKEN` | Vercel Personal Access Token (PAT) |

### Optional

| Var | Purpose |
|---|---|
| `OA_VERCEL_TEAM_ID` | Team ID — scopes all API calls to a team via `?teamId=` query param |
| `OA_VERCEL_ENDPOINT` | API base URL override (default: `https://api.vercel.com`) |

## Operations

| Method | Vercel endpoint(s) |
|---|---|
| `createProject(opts)` | `POST /v11/projects` |
| `destroyProject(p, confirm)` | `DELETE /v9/projects/{idOrName}` |
| `deploy(p, env, opts)` | `POST /v13/deployments` (git-source; project must be git-linked) |
| `rollback(p, deploymentId)` | `POST /v10/projects/{idOrName}/promote/{deploymentId}` |
| `setEnv(p, vars, env)` | `POST /v10/projects/{idOrName}/env` + `PATCH .../env/{id}` |
| `getEnv(p, env)` | `GET /v9/projects/{idOrName}/env?decrypt=true` |
| `attachDomain(p, domain)` | `POST /v10/projects/{idOrName}/domains` |
| `detachDomain(p, domain)` | `DELETE /v9/projects/{idOrName}/domains/{domain}` |
| `logs(p, opts)` | `GET /v3/deployments/{idOrName}/events` |
| `exportState(p)` | composite: getEnv × 3 + GET domains |
| `importState(bundle)` | composite: createProject + setEnv × 3 + attachDomain × N |

## Common errors

| Code | Meaning | Fix |
|---|---|---|
| `E_VERCEL_AUTH` | Bad, missing, expired, or revoked token | Regenerate PAT at vercel.com/account/tokens |
| `E_VERCEL_NOT_FOUND` | Project, deployment, or domain does not exist | Verify `idOrName`; use `createProject` first |
| `E_VERCEL_PERMISSION` | Token lacks scope for this team or project | Use a token with access to the target team; check `OA_VERCEL_TEAM_ID` |
| `E_VERCEL_INVALID` | Bad slug/name, malformed body, name conflict, missing ConfirmToken | Fix input; check `context.vercelErrorMessage` for Vercel's detail |
| `E_VERCEL_RATE_LIMIT` | Rate limit hit | Respect `context.retryAfter` (seconds); adapter does not auto-retry |
| `E_VERCEL_NETWORK` | `fetch`-level failure (DNS, TCP, abort) | Check connectivity; retry after backoff |
| `E_VERCEL_UPSTREAM` | HTTP 5xx or unmapped error from Vercel | Transient; retry; report if persistent |
| `E_VERCEL_NO_GIT_LINK` | `deploy` called but project has no git link | Connect the project to a git repo via the Vercel dashboard |
| `E_VERCEL_BAD_STATE` | `importState` received a bundle with wrong version or missing fields | Export a fresh bundle from the source project |

## Gotchas

- **`deploy` requires a git-linked project.** Connect the repo via the Vercel UI first. Pass `opts.ref`; default is the project's production branch.
- **`setEnv` is additive.** Vars absent from the `vars` argument are left unchanged. Delete vars via Vercel dashboard or API.
- **`logs` dedupes** when `tail: true` via an in-memory `seenIds` set.
- **`regions` is ignored** — Vercel manages regions implicitly.
