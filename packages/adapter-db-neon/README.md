# @openagentry/adapter-db-neon

OpenAgentry `DatabaseAdapter` implementation backed by Neon Postgres.

Status: `0.1.0-alpha.0` — first concrete database adapter for OpenAgentry. API not yet stable.

## Install

```bash
pnpm add @openagentry/adapter-db-neon @openagentry/core
```

## Use

```ts
import { createNeonDatabaseAdapter } from '@openagentry/adapter-db-neon';

const db = createNeonDatabaseAdapter({
  apiKey: process.env.NEON_API_KEY!,
});

const instance = await db.createInstance({
  name: 'My App',
  slug: 'my-app',
  engine: 'postgres',
  perEnvBranches: true,
});
const url = await db.connectionString(instance, 'prod');
```

See `LLM.md` for agent-facing context.

## Conformance

```bash
NEON_API_KEY=... \
  pnpm --filter @openagentry/adapter-db-neon test:integration
```

## License

Apache-2.0.
