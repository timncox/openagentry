# @openagentry/core

Public TypeScript SDK for [OpenAgentry](https://openagentry.dev). Defines
adapter interfaces, plugin protocol, and runtime helpers — imported by every
official scaffold and adapter.

**Zero vendor coupling.** Vendor implementations live in
`@openagentry/adapter-*` packages.

## Install

```bash
npm install @openagentry/core
# or
pnpm add @openagentry/core
```

## Use

```ts
import {
  AgentryError,
  registerAdapter,
  useAdapter,
  type HostAdapter,
} from '@openagentry/core';

// At app startup the runtime registers configured adapters
registerAdapter('host', cloudflareHostAdapter);

// Scaffold code uses the resolver — never imports a specific adapter
const host = useAdapter<HostAdapter>('host');
await host.deploy(project, 'prod');
```

## Adapter categories

`host`, `db`, `auth`, `email`, `llm`, `storage`, `kv`, `cron`, `domain`,
`repo`, `wiki`, `billing`, `push`.

Each has a TypeScript interface in `src/adapters/<category>.ts`.

## Plugin manifest

Plugins declare an `openagentry` block in their `package.json`:

```json
{
  "openagentry": {
    "type": "adapter",
    "category": "host",
    "id": "host-cloudflare",
    "protocolVersion": "1",
    "envVars": [
      { "name": "CLOUDFLARE_API_TOKEN", "secret": true, "required": true }
    ],
    "fillsSlots": ["host", "kv", "storage"],
    "capabilities": { "deploy": true, "rollback": true, "cron": true },
    "aiFriendly": {
      "structuredErrors": true,
      "dryRun": true,
      "idempotent": ["deploy", "setEnv", "attachDomain"],
      "queryableState": true
    },
    "llmDocs": "./LLM.md"
  }
}
```

Validate with `validateManifest(json)` — throws `AgentryError` on bad input.

## Errors

Every adapter operation throws `AgentryError` on failure. AI-friendly:
errors carry `code`, `phase`, `suggestedFix`, `docs`, and `context` so an
agent can recover without asking the user.

## License

[Apache-2.0](../../LICENSE)
