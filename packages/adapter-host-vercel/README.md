# @openagentry/adapter-host-vercel

OpenAgentry `HostAdapter` implementation backed by the Vercel REST API.

Status: `0.1.0-alpha.0` — second concrete host adapter for OpenAgentry (first is `adapter-host-cloudflare`); proves swappability of the host abstraction. API not yet stable.

## Install

```bash
pnpm add @openagentry/adapter-host-vercel @openagentry/core
```

## Use

```ts
import { createVercelHostAdapter } from '@openagentry/adapter-host-vercel';

const adapter = createVercelHostAdapter({
  token: process.env.OA_VERCEL_TOKEN!,
  teamId: process.env.OA_VERCEL_TEAM_ID, // optional
});

const project = await adapter.createProject({
  name: 'my-site',
  slug: 'my-site',
});

// Project must be git-linked in the Vercel dashboard before deploying
await adapter.deploy(project, 'preview', { ref: 'main' });
```

Or let the adapter bootstrap itself from env vars:

```ts
import vercelAdapter from '@openagentry/adapter-host-vercel';
// reads OA_VERCEL_TOKEN + OA_VERCEL_TEAM_ID at first use
await vercelAdapter.createProject({ name: 'my-site', slug: 'my-site' });
```

See `LLM.md` for agent-facing context.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `OA_VERCEL_TOKEN` | yes | Vercel Personal Access Token (PAT) |
| `OA_VERCEL_TEAM_ID` | no | Team ID — scopes all API calls via `?teamId=` |
| `OA_VERCEL_ENDPOINT` | no | API base URL override (default: `https://api.vercel.com`) |

## Conformance

```bash
# unit + MSW-mocked conformance (no credentials needed)
pnpm --filter @openagentry/adapter-host-vercel test

# full integration against a real Vercel account
OA_VERCEL_TOKEN=... OA_VERCEL_TEAM_ID=... \
  pnpm --filter @openagentry/adapter-host-vercel test:integration
```

## License

Apache-2.0.
