# @openagentry/adapter-repo-github

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](CHANGELOG.md)

`RepoAdapter` for [OpenAgentry](https://github.com/timncox/openagentry), backed by the [GitHub REST API v3](https://docs.github.com/en/rest). The first concrete `RepoAdapter` in the OpenAgentry default adapter set.

## Install

```bash
pnpm add @openagentry/adapter-repo-github @openagentry/core
```

## Quick start

### Default export (env-based, lazy)

```ts
import repo from '@openagentry/adapter-repo-github';

// Reads OA_GITHUB_TOKEN (required) and OA_GITHUB_ENDPOINT (optional) from env.
// The lazy default is constructed on the first method call.
const result = await repo.create({
  owner: 'my-org',
  name: 'my-new-repo',
  visibility: 'private',
});
console.log(result.url);
```

### Explicit construction

```ts
import { createGithubRepoAdapter } from '@openagentry/adapter-repo-github';

const repo = createGithubRepoAdapter({
  token: process.env.GITHUB_PAT!,
  endpoint: 'https://github.example.com/api/v3', // optional — GitHub Enterprise Server
});

const found = await repo.get('my-org', 'my-repo');
if (found) {
  console.log(found.defaultBranch, found.visibility);
}
```

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `OA_GITHUB_TOKEN` | yes | GitHub Personal Access Token (classic `repo` scope or fine-grained "Administration: Read and write") |
| `OA_GITHUB_ENDPOINT` | no | API base URL — override for GitHub Enterprise Server; defaults to `https://api.github.com` |

Full error reference, gotchas, and GHE setup notes: see [LLM.md](./LLM.md).

## API reference

All methods are declared on `RepoAdapter` in `@openagentry/core`. This adapter implements:

| Method | Signature |
|---|---|
| `create` | `(opts: CreateRepoOptions) => Promise<Repository>` |
| `delete` | `(repo: Repository, confirm: ConfirmToken) => Promise<void>` |
| `get` | `(owner: string, name: string) => Promise<Repository \| null>` |
| `remoteUrl` | `(repo: Repository, mode: 'https' \| 'ssh') => string` |

All failures throw `AgentryError` with stable codes: `E_GITHUB_AUTH`, `E_GITHUB_NOT_FOUND`, `E_GITHUB_PERMISSION`, `E_GITHUB_INVALID`, `E_GITHUB_RATE_LIMIT`, `E_GITHUB_NETWORK`, `E_GITHUB_UPSTREAM`.

## Known limitations (v0)

- **No branch, PR, issue, release, webhook, or Actions operations.** The v0 `RepoAdapter` interface covers create/delete/get/remoteUrl only. Richer operations are deferred until a second `RepoAdapter` (GitLab/Gitea/Bitbucket) establishes what belongs in the cross-vendor interface.
- **`internal` repos appear as `private`.** GitHub Enterprise Server's `internal` visibility is mapped to `'private'` in the v0 interface. See LLM.md.
- **`delete` is not idempotent.** GitHub returns 404 when deleting a nonexistent repo; the adapter surfaces this as `E_GITHUB_NOT_FOUND`. Use `get` first if idempotency is needed.
- **One extra `GET /user` on first `create` per adapter instance.** The adapter probes the authenticated login to route user vs. org creates correctly. Result is cached for the adapter's lifetime.
- **No local-git operations.** Push, fetch, branch creation, and clone belong to a local orchestrator — not a registrar adapter.

## License

Apache-2.0.

---

See [LLM.md](./LLM.md) for the concise operator reference (errors, gotchas, field mapping).
