# Changelog

## 0.1.0-alpha.0 (2026-05-07)

Initial alpha release.

- Implements all six `DomainAdapter` methods: `checkAvailability`, `purchase`, `listRecords`, `setRecord`, `deleteRecord`, `initiateTransfer`.
- Backed by the [Namecheap XML API](https://www.namecheap.com/support/api/intro/) via `fast-xml-parser` (no SDK).
- Single HTTP chokepoint (`http.ts`) with `namecheapFetch` — auth query-string construction, XML parse, and Namecheap `Number` code → `AgentryError` translation.
- Seven stable error codes: `E_NAMECHEAP_AUTH`, `E_NAMECHEAP_IP_NOT_WHITELISTED`, `E_NAMECHEAP_DOMAIN_NOT_FOUND`, `E_NAMECHEAP_INVALID`, `E_NAMECHEAP_RATE_LIMIT`, `E_NAMECHEAP_NETWORK`, `E_NAMECHEAP_UPSTREAM`.
- DNS write ops (`setRecord`, `deleteRecord`) use read-modify-write cycle (`getHosts` + `setHosts`) — documented as a known concurrency limitation.
- Manifest includes sandbox flag, `dnsRecordTypes` capability, `ipWhitelistRequired: true`, and `purchase: true`.
- Lazy default export from `OA_NAMECHEAP_API_USER` + `OA_NAMECHEAP_API_KEY` + `OA_NAMECHEAP_CLIENT_IP` (plus optional sandbox/endpoint/contact env vars).
- Conforms to `@openagentry/adapter-test-suite@0.1.0-alpha.3` domain suite (universal checks + `domain/structured-errors`; opt-in `domain/dns-roundtrip`).

Spec: `/Users/timcox/tim-os/docs/superpowers/specs/2026-05-07-openagentry-adapter-domain-namecheap-design.md`
