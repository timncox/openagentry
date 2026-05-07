# @openagentry/adapter-storage-r2

OpenAgentry `StorageAdapter` for Cloudflare R2 (S3-compatible).

## Identity

- **ADAPTER_ID:** `storage-r2`
- **Category:** `storage`
- **Plugin manifest:** `aiFriendly.idempotent: ["delete"]`

## Quick start

```bash
export OA_R2_ACCOUNT_ID=<32-char-hex>
export OA_R2_ACCESS_KEY_ID=<key>
export OA_R2_SECRET_ACCESS_KEY=<secret>
export OA_R2_BUCKET=<bucket-name>
# optional
export OA_R2_PUBLIC_BASE_URL=https://files.example.com
export OA_R2_PRESIGN_TTL=3600
```

```ts
import storage from '@openagentry/adapter-storage-r2';

await storage.put('reports/2026-q1.pdf', pdfBuffer, { contentType: 'application/pdf' });
const obj = await storage.get('reports/2026-q1.pdf');
for await (const item of storage.list('reports/')) console.log(item.key);
await storage.delete('reports/2026-q1.pdf');
```

For a non-default config:

```ts
import { createR2StorageAdapter } from '@openagentry/adapter-storage-r2';
const storage = createR2StorageAdapter({ accountId: '...', accessKeyId: '...', secretAccessKey: '...', bucket: '...' });
```

## Configuration

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `accountId` | string | yes | — | 32-char lowercase hex (Cloudflare account ID) |
| `accessKeyId` | string | yes | — | R2 API access key |
| `secretAccessKey` | string | yes | — | R2 API secret |
| `bucket` | string | yes | — | Bucket name (3-63 chars, lowercase) |
| `publicBaseUrl` | string | no | — | Required when calling `put({ public: true })` |
| `presignTtlSeconds` | number | no | 3600 | Presigned URL TTL, clamped `[60, 604800]` |
| `endpoint` | string | no | derived | Override for testing (e.g., MinIO) |
| `region` | string | no | `auto` | SigV4 requires it; R2 ignores it |

## Operations

### `put(key, body, opts?) → StorageObject`

Uploads a single object via S3 PUT. **Single-PUT only — max ~5 GB.** No multipart upload in v0.

| `opts` field | Effect |
|---|---|
| `contentType` | Overrides extension-based sniffing. |
| `public: true` | Returns `publicBaseUrl + key` as `url`. Sets `x-amz-meta-oa-public: 1` so `get()` round-trips. Throws `E_R2_PUBLIC_NOT_CONFIGURED` if `publicBaseUrl` not set. |
| `cacheControl` | Overrides defaults (`public, max-age=31536000, immutable` for public; `private, no-cache` for private). |
| `meta` | Custom headers `x-amz-meta-<key>`; keys are lowercased. |

Throws: `E_R2_INVALID_KEY`, `E_R2_PUBLIC_NOT_CONFIGURED`, `E_R2_PERMISSION`, `E_R2_NETWORK`, `E_R2_UPSTREAM`.

### `get(key) → StorageObject | null`

HEAD-based metadata fetch. Returns `null` for 404. Reads `x-amz-meta-oa-public` to choose URL flavor.

Throws: `E_R2_INVALID_KEY`, `E_R2_PERMISSION`, `E_R2_NETWORK`, `E_R2_UPSTREAM`.

### `delete(key) → void`

Idempotent — 204 always; 404 also acceptable (no throw).

Throws: `E_R2_INVALID_KEY`, `E_R2_PERMISSION`, `E_R2_NETWORK`, `E_R2_UPSTREAM`.

### `list(prefix?) → AsyncIterable<StorageObject>`

Paginated via S3 ListObjectsV2 + continuation tokens. URLs in list results are always **presigned** (custom metadata isn't returned by ListObjectsV2 in S3, so `list` cannot round-trip the public flag).

Throws: `E_R2_PERMISSION`, `E_R2_NETWORK`, `E_R2_UPSTREAM`.

## URL strategy

`StorageObject.url` resolves differently for public vs private:

- **`opts.public: true`** — `url` = `publicBaseUrl + '/' + key`. Stable. Cacheable. The bucket / `publicBaseUrl` must be reachable (`pub-XXX.r2.dev` subdomain or custom domain on Cloudflare).
- **default (private)** — `url` = SigV4-presigned GET URL with TTL `presignTtlSeconds` (default 3600s). Transient. **Don't persist these URLs** — they expire.

## Error codes

| Code | Cause |
|---|---|
| `E_R2_NOT_FOUND` | HEAD returned 404; surfaces in delete/list propagation rarely |
| `E_R2_PERMISSION` | HTTP 401/403 |
| `E_R2_INVALID_KEY` | empty / leading slash / double slash / control chars / >1024 chars |
| `E_R2_NETWORK` | `fetch` rejected (DNS, ECONNREFUSED, timeout, etc.) |
| `E_R2_PUBLIC_NOT_CONFIGURED` | `put({ public: true })` without `publicBaseUrl` in config |
| `E_R2_UPSTREAM` | 5xx, unexpected 4xx, malformed XML response |

All errors are `AgentryError`s with `adapter: 'storage-r2'` and `suggestedFix`. Detect with `isAgentryError(err)` from `@openagentry/core` (cross-realm safe — don't use `instanceof`).

## Idempotency

| Op | Idempotent? | Why |
|---|---|---|
| `put` | no | regenerates `uploadedAt` and presigned URL on each call |
| `get` | yes | read-only; safe to retry |
| `delete` | yes | S3 returns 204 even on missing key |
| `list` | yes | read-only; safe to retry |

## Limits in v0 alpha

- Single-PUT only (~5 GB). No multipart upload.
- No range / partial GET reads.
- No streaming uploads.
- No Cloudflare Workers binding driver — use the S3 API everywhere.
- No `agentry doctor` integration. Validate manually.
- No retry layer. Surface 5xx directly; caller retries if needed.

## Conformance test

```bash
pnpm --filter @openagentry/adapter-storage-r2 test
```

Requires Docker (uses `@testcontainers/minio` for MinIO).

## Pairing

Designed to pair with `@openagentry/adapter-host-cloudflare` for scaffolds running on Workers. The R2 bucket can live in the same Cloudflare account as the Worker — egress between them is free.
