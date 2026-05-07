# @openagentry/adapter-storage-r2

OpenAgentry `StorageAdapter` for Cloudflare R2 (S3-compatible).

## Identity

- **ADAPTER_ID:** `storage-r2`
- **Category:** `storage`
- **Manifest:** `aiFriendly.idempotent: ["delete"]`

## Quick start

```bash
export OA_R2_ACCOUNT_ID=<32-char-hex>
export OA_R2_ACCESS_KEY_ID=<key>
export OA_R2_SECRET_ACCESS_KEY=<secret>
export OA_R2_BUCKET=<bucket>
# optional
export OA_R2_PUBLIC_BASE_URL=https://files.example.com
export OA_R2_PRESIGN_TTL=3600
```

```ts
import storage from '@openagentry/adapter-storage-r2';
await storage.put('a.pdf', buf, { contentType: 'application/pdf' });
const obj = await storage.get('a.pdf');           // null on 404
for await (const i of storage.list('reports/')) console.log(i.key);
await storage.delete('a.pdf');                    // idempotent
```

Or via `createR2StorageAdapter({ accountId, accessKeyId, secretAccessKey, bucket })`.

## Configuration

| Field | Required | Default | Notes |
|---|---|---|---|
| `accountId` | yes | — | 32-char lowercase hex |
| `accessKeyId` / `secretAccessKey` | yes | — | R2 API creds |
| `bucket` | yes | — | 3-63 chars, lowercase |
| `publicBaseUrl` | no | — | Required for `put({public:true})` |
| `presignTtlSeconds` | no | 3600 | `[60, 604800]` |
| `endpoint` | no | derived | Override for testing |
| `region` | no | `auto` | SigV4 needs it |

## Operations

`put(key, body, opts?) → StorageObject` — single PUT, max ~5 GB. `opts.public:true` returns stable `publicBaseUrl + key` URL and sets `x-amz-meta-oa-public: 1`. `opts.contentType` overrides extension sniffing. `opts.cacheControl` overrides public-vs-private defaults. `opts.meta` keys are lowercased into `x-amz-meta-*`.

`get(key) → StorageObject | null` — HEAD-based metadata fetch. Returns `null` on 404. Reads `x-amz-meta-oa-public` to round-trip URL flavor.

`delete(key) → void` — idempotent (204; 404 also OK).

`list(prefix?) → AsyncIterable<StorageObject>` — paginated via ListObjectsV2 + continuation tokens. URLs in list results are always presigned (S3 list doesn't return custom metadata).

## URL strategy

- `opts.public: true` → `publicBaseUrl + '/' + key`. Stable. Cacheable.
- default → SigV4-presigned GET URL with TTL `presignTtlSeconds` (default 1h). **Transient — don't persist.**

## Error codes

All errors are `AgentryError`s with `adapter: 'storage-r2'` and `suggestedFix`. Detect via `isAgentryError(err)` from `@openagentry/core` — never `instanceof`.

| Code | Cause |
|---|---|
| `E_R2_NOT_FOUND` | HEAD 404 (`get` returns `null` instead) |
| `E_R2_PERMISSION` | HTTP 401/403 |
| `E_R2_INVALID_KEY` | empty / leading `/` / `//` / control chars / >1024 chars |
| `E_R2_NETWORK` | `fetch` rejected |
| `E_R2_PUBLIC_NOT_CONFIGURED` | `put({public:true})` w/o `publicBaseUrl` |
| `E_R2_UPSTREAM` | 5xx, malformed XML, unexpected 4xx |

## Idempotency

`get`/`delete`/`list` are idempotent. `put` is not (regenerates `uploadedAt` and presigned URL).

## Limits in v0 alpha

Single PUT only (~5 GB). No multipart, range reads, streaming, Workers binding driver, doctor checks, or retry layer.

## Conformance test

```bash
pnpm --filter @openagentry/adapter-storage-r2 test
```

Requires Docker (uses `@testcontainers/minio`).

## Pairing

Designed to pair with `@openagentry/adapter-host-cloudflare` for Workers scaffolds. Same Cloudflare account = free egress between Worker and bucket.
