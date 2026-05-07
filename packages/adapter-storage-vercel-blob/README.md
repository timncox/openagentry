# @openagentry/adapter-storage-vercel-blob

[`StorageAdapter`](https://github.com/timncox/openagentry/tree/main/packages/core) implementation backed by [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) via the official [`@vercel/blob`](https://www.npmjs.com/package/@vercel/blob) SDK.

Pairs with [`@openagentry/adapter-host-vercel`](../adapter-host-vercel) for projects deployed on Vercel; can also be used standalone with any token-bearing client.

## Install

```bash
pnpm add @openagentry/adapter-storage-vercel-blob
```

## Quick start

```ts
import storage from '@openagentry/adapter-storage-vercel-blob';

const out = await storage.put('uploads/avatar.png', pngBytes, {
  public: true,
  contentType: 'image/png',
});
console.log(out.url); // https://<store>.public.blob.vercel-storage.com/uploads/avatar.png
```

The default export reads `OA_VERCEL_BLOB_TOKEN` from `process.env` lazily on first call. Or construct an adapter explicitly:

```ts
import { createVercelBlobStorageAdapter } from '@openagentry/adapter-storage-vercel-blob';

const storage = createVercelBlobStorageAdapter({
  token: process.env.MY_TOKEN!,
  defaultAccess: 'public',
});
```

## Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `OA_VERCEL_BLOB_TOKEN` | yes | — | Vercel Blob read-write token (Vercel dashboard → Storage → Blob → Tokens). |
| `OA_VERCEL_BLOB_DEFAULT_ACCESS` | no | `private` | `public` or `private`. PUT-time access default when `opts.public` is unspecified. |
| `OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC` | no | `31536000` | Seconds. Default `cacheControlMaxAge` for public uploads. |
| `OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE` | no | `3600` | Seconds. Default `cacheControlMaxAge` for private uploads. |

We use `OA_VERCEL_BLOB_TOKEN` (not Vercel's own `BLOB_READ_WRITE_TOKEN`) to keep adapter env naming consistent with the rest of OpenAgentry. On Vercel, copy the value or remap.

## Public vs private blobs

- Public blobs live at `https://<store>.public.blob.vercel-storage.com/<key>` and are anonymously fetchable.
- Private blobs live at `https://<store>.private.blob.vercel-storage.com/<key>` and require the token to fetch — Vercel does not issue presigned URLs.

Pass `{ public: true }` per call to override the default. The `opts.public` flag is three-way:

- `true` → public
- `false` → private
- `undefined` → `defaultAccess` from config

## What's NOT in v0

- Multipart uploads (single PUT only; max object size is whatever Vercel allows for single-PUT, currently 5GB).
- Streaming uploads (body is `ArrayBuffer | Uint8Array | string`).
- `opts.meta` (Vercel Blob has no custom-metadata field; ignored silently).
- `copy()`, conditional writes (`ifMatch`/`ifNoneMatch`), client uploads.
- Range/partial GET reads.

For S3-compatible behavior (custom metadata, presigned URLs, multipart), use [`@openagentry/adapter-storage-r2`](../adapter-storage-r2).

## LLM-facing docs

See [`LLM.md`](./LLM.md) — the doc shipped to LLM consumers via `package.json#openagentry.llmDocs`.

## License

Apache-2.0
