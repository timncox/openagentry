# @openagentry/adapter-domain-namecheap

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](CHANGELOG.md)

`DomainAdapter` for [OpenAgentry](https://github.com/timncox/openagentry), backed by the [Namecheap XML API](https://www.namecheap.com/support/api/intro/). The first concrete `DomainAdapter` in the OpenAgentry default adapter set.

## Install

```bash
pnpm add @openagentry/adapter-domain-namecheap @openagentry/core
```

## Quick start

### Default export (env-based, lazy)

```ts
import domain from '@openagentry/adapter-domain-namecheap';

// Reads OA_NAMECHEAP_API_USER, OA_NAMECHEAP_API_KEY, OA_NAMECHEAP_CLIENT_IP from env
const avail = await domain.checkAvailability('example.com');
console.log(avail.available, avail.priceUsd);
```

### Explicit construction

```ts
import { createNamecheapDomainAdapter } from '@openagentry/adapter-domain-namecheap';

const domain = createNamecheapDomainAdapter({
  apiUser: 'myuser',
  apiKey:  process.env.NC_API_KEY!,
  clientIp: '203.0.113.42',
  useSandbox: true,           // optional — sandbox endpoint
});
```

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `OA_NAMECHEAP_API_USER` | yes | Namecheap API username |
| `OA_NAMECHEAP_API_KEY` | yes | Namecheap API key (secret) |
| `OA_NAMECHEAP_CLIENT_IP` | yes | Whitelisted IP sent on every request |
| `OA_NAMECHEAP_USERNAME` | no | Domain-owner username (defaults to `API_USER`) |
| `OA_NAMECHEAP_USE_SANDBOX` | no | `1` or `true` → sandbox endpoint |
| `OA_NAMECHEAP_ENDPOINT` | no | Explicit endpoint override |
| `OA_NAMECHEAP_CONTACT_*` | no* | Registrant contact fields (*required at `purchase()` time) |

Full env-var reference, sandbox setup, and SLD/TLD split notes: see [LLM.md](./LLM.md).

**Sandbox vs. production.** Set `OA_NAMECHEAP_USE_SANDBOX=1` to route all calls to `api.sandbox.namecheap.com`. Sandbox credentials differ from production — obtain them at [sandbox.namecheap.com](https://www.sandbox.namecheap.com/). The integration test suite (`tests/integration.test.ts`) is gated on `OA_NAMECHEAP_SANDBOX_API_USER`, `OA_NAMECHEAP_SANDBOX_API_KEY`, and `OA_NAMECHEAP_SANDBOX_CLIENT_IP` to avoid accidentally hitting production.

## API reference

All methods are declared on `DomainAdapter` in `@openagentry/core`. This adapter implements:

| Method | Signature |
|---|---|
| `checkAvailability` | `(domain: string) => Promise<DomainAvailability>` |
| `purchase` | `(domain: string, years?: number) => Promise<Domain>` |
| `listRecords` | `(domain: string) => Promise<DnsRecord[]>` |
| `setRecord` | `(domain: string, record: DnsRecord) => Promise<void>` |
| `deleteRecord` | `(domain: string, record: DnsRecord) => Promise<void>` |
| `initiateTransfer` | `(domain: string, authCode: string) => Promise<DomainTransfer>` |

All failures throw `AgentryError` with stable codes: `E_NAMECHEAP_AUTH`, `E_NAMECHEAP_IP_NOT_WHITELISTED`, `E_NAMECHEAP_DOMAIN_NOT_FOUND`, `E_NAMECHEAP_INVALID`, `E_NAMECHEAP_RATE_LIMIT`, `E_NAMECHEAP_NETWORK`, `E_NAMECHEAP_UPSTREAM`.

## Known limitations (v0)

- **Read-modify-write DNS.** `setRecord` and `deleteRecord` use `getHosts` + `setHosts` (Namecheap replaces all records atomically). Concurrent writes to the same domain can lose updates. Callers must serialize.
- **Premium domain purchase blocked.** `checkAvailability` surfaces the premium price, but `purchase()` rejects premium domains (`E_NAMECHEAP_INVALID`). Purchase via the Namecheap dashboard.
- **Single domain per `checkAvailability` call.** The Namecheap API supports up to 50 in one call; the interface only accepts one at a time. Bulk support requires an interface change.
- **No WHOIS privacy, registrar-lock, or DNSSEC controls.** Deferred to future plans.
- **IP whitelisting required.** Add your server IP at Namecheap → Profile → Tools → API Access.

## License

Apache-2.0.

---

See [LLM.md](./LLM.md) for the concise operator reference (errors, gotchas, field mapping).
