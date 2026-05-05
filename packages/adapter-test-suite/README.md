# @openagentry/adapter-test-suite

Conformance runner for OpenAgentry adapters. Universal AI-friendliness checks plus per-category functional suites. Adapters that pass earn `verified: true` in the catalog.

## Quick start

```bash
npx @openagentry/adapter-test-suite host --target ./packages/adapter-host-cloudflare
```

Exit code `0` if all checks pass, `1` if any fail.

## Library

```ts
import { runSuite } from '@openagentry/adapter-test-suite';

const result = await runSuite({ target: '/abs/path/to/adapter' });
console.log(result.passed, '/', result.total);
```

See `LLM.md` for agent-facing reference.
