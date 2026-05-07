# @openagentry/adapter-storage-r2

[![Version](https://img.shields.io/npm/v/@openagentry/adapter-storage-r2.svg)](https://www.npmjs.com/package/@openagentry/adapter-storage-r2)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

`StorageAdapter` implementation for OpenAgentry, backed by **Cloudflare R2** via the S3-compatible API.

## Why R2?

- **No egress fees.** Read it from anywhere — workers, browsers, agents — without per-byte charges.
- **S3-compatible.** SigV4, ListObjectsV2, presigned URLs all work out of the box.
- **Pairs natively with Cloudflare Workers.** Same account; same network; cheap and fast.

## Install

```bash
pnpm add @openagentry/adapter-storage-r2
```

## Usage

See [`LLM.md`](./LLM.md) for the complete reference. Quick start:

```ts
import storage from '@openagentry/adapter-storage-r2';

await storage.put('reports/2026-q1.pdf', pdfBuffer);
const obj = await storage.get('reports/2026-q1.pdf');
await storage.delete('reports/2026-q1.pdf');
```

## Configuration

Required env vars: `OA_R2_ACCOUNT_ID`, `OA_R2_ACCESS_KEY_ID`, `OA_R2_SECRET_ACCESS_KEY`, `OA_R2_BUCKET`.

Optional: `OA_R2_PUBLIC_BASE_URL`, `OA_R2_PRESIGN_TTL`, `OA_R2_ENDPOINT`.

For a non-default config, use `createR2StorageAdapter(input)` directly.

## URL strategy

- `put(key, body, { public: true })` — returns a stable URL via `publicBaseUrl`.
- `put(key, body)` — returns a transient SigV4-presigned GET URL (default 1h TTL).

The public flag round-trips through custom metadata (`x-amz-meta-oa-public: 1`), so `get()` returns the same URL flavor the object was uploaded with.

## Limits

This v0 alpha ships single-PUT uploads only (max ~5 GB). Multipart, streaming, range reads, and Workers binding integration are deferred.

## Troubleshooting

- **403 on every request** — verify the access key is scoped to the bucket with `Object Read & Write`.
- **`E_R2_PUBLIC_NOT_CONFIGURED`** — set `publicBaseUrl` in config or `OA_R2_PUBLIC_BASE_URL` env var.
- **Presigned URLs return 403** — most often clock skew. Confirm system time is accurate.
- **Local development** — run `pnpm test` to exercise the adapter against a MinIO container; no real R2 credentials needed.

## License

Apache-2.0.
