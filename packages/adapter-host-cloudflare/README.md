# @openagentry/adapter-host-cloudflare

OpenAgentry `HostAdapter` implementation backed by Cloudflare Pages.

Status: `0.1.0-alpha.0` — first concrete host adapter for OpenAgentry. API not yet stable.

## Install

```bash
pnpm add @openagentry/adapter-host-cloudflare @openagentry/core
```

## Use

```ts
import { createCloudflareHostAdapter } from '@openagentry/adapter-host-cloudflare';

const adapter = createCloudflareHostAdapter({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
});

const project = await adapter.createProject({
  name: 'my-site',
  slug: 'my-site',
  meta: { srcDir: './dist' },
});

await adapter.deploy(project, 'preview');
```

See `LLM.md` for agent-facing context.

## Conformance

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  pnpm --filter @openagentry/adapter-host-cloudflare test:integration
```

## License

Apache-2.0.
