# @openagentry/core

Public TypeScript SDK for OpenAgentry. Defines:

- **Adapter interfaces** for every category (host, db, auth, email, llm, storage, domain, repo, wiki)
- **Plugin protocol** including manifest schema and version helpers
- **Runtime helpers**: `useAdapter` resolver, `AgentryError`, adapter context

Imported by every official scaffold and adapter. Zero vendor coupling.

```bash
npm install @openagentry/core
```

```ts
import type { HostAdapter } from '@openagentry/core';
import { useAdapter } from '@openagentry/core';

const host = useAdapter<HostAdapter>('host');
await host.deploy(project, 'prod');
```

License: Apache-2.0
