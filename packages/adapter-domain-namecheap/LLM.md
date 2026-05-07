# @openagentry/adapter-domain-namecheap

Adapter ID: `domain-namecheap`

## What it does

Manages domains and DNS records via the Namecheap XML API. Implements `DomainAdapter` from `@openagentry/core`: check availability, purchase, list/set/delete DNS records, and initiate transfers.

## Env vars

### Required

| Var | Purpose |
|---|---|
| `OA_NAMECHEAP_API_USER` | Namecheap API username |
| `OA_NAMECHEAP_API_KEY` | Namecheap API key (secret) |
| `OA_NAMECHEAP_CLIENT_IP` | IP whitelisted in Namecheap account |

### Optional — core

| Var | Purpose |
|---|---|
| `OA_NAMECHEAP_USERNAME` | Domain-owner username (defaults to `API_USER`) |
| `OA_NAMECHEAP_USE_SANDBOX` | Set `1` or `true` to use sandbox endpoint |
| `OA_NAMECHEAP_ENDPOINT` | Explicit endpoint override (takes precedence) |

### Optional — registrant contact (required only at `purchase()` time)

`OA_NAMECHEAP_CONTACT_FIRST_NAME`, `OA_NAMECHEAP_CONTACT_LAST_NAME`, `OA_NAMECHEAP_CONTACT_ADDRESS1`, `OA_NAMECHEAP_CONTACT_CITY`, `OA_NAMECHEAP_CONTACT_STATE_PROVINCE`, `OA_NAMECHEAP_CONTACT_POSTAL_CODE`, `OA_NAMECHEAP_CONTACT_COUNTRY` (ISO 3166-1 alpha-2), `OA_NAMECHEAP_CONTACT_PHONE` (`+1.5551234567` format), `OA_NAMECHEAP_CONTACT_EMAIL`.

## Operations

| Method | What it does | Namecheap command(s) |
|---|---|---|
| `checkAvailability(domain)` | Returns availability + premium price | `domains.check` |
| `purchase(domain, years)` | Registers domain (requires contact env vars) | `domains.create` + `domains.getInfo` |
| `listRecords(domain)` | Returns all DNS host records | `domains.dns.getHosts` |
| `setRecord(domain, record)` | Upserts a DNS record (read-modify-write) | `domains.dns.getHosts` + `setHosts` |
| `deleteRecord(domain, record)` | Removes a matching DNS record (read-modify-write) | `domains.dns.getHosts` + `setHosts` |
| `initiateTransfer(domain, authCode)` | Starts an inbound domain transfer | `domains.transfer.create` |

## Errors

| Code | Meaning | Fix |
|---|---|---|
| `E_NAMECHEAP_AUTH` | Bad API user/key, disabled or suspended account | Check credentials in Namecheap dashboard |
| `E_NAMECHEAP_IP_NOT_WHITELISTED` | Caller's IP not in Namecheap whitelist | Add IP at Profile → Tools → API Access |
| `E_NAMECHEAP_DOMAIN_NOT_FOUND` | Domain not in account or not registered | Verify domain ownership; check SLD/TLD split |
| `E_NAMECHEAP_INVALID` | Bad input: domain shape, unsupported TLD, missing contact, premium domain | Fix input or supply missing env vars |
| `E_NAMECHEAP_RATE_LIMIT` | API rate-limited | Back off and retry; adapter does not retry |
| `E_NAMECHEAP_NETWORK` | `fetch` failed (DNS, timeout, abort) | Check network; retry after backoff |
| `E_NAMECHEAP_UPSTREAM` | HTTP 5xx or unmapped Namecheap error code | Transient; retry; report if persistent |

## Gotchas

- **DNS writes are read-modify-write.** `setRecord` and `deleteRecord` each fetch all existing hosts, compute the new list, and replace all. Concurrent writers on the same domain can lose updates — callers must serialize mutations.
- **IP whitelisting is mandatory.** Every API call requires `ClientIp` to match a whitelisted IP. Configure at Namecheap dashboard → Profile → Tools → API Access. The adapter surfaces this as `E_NAMECHEAP_IP_NOT_WHITELISTED` (not a generic auth error) to make the fix obvious.
- **Premium domain purchase is rejected.** `checkAvailability` reports `priceUsd` for premium names. Calling `purchase()` on a premium domain throws `E_NAMECHEAP_INVALID` with a `suggestedFix` pointing at the Namecheap dashboard.
