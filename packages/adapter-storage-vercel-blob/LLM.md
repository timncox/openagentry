# @openagentry/adapter-storage-vercel-blob

OpenAgentry `StorageAdapter` backed by Vercel Blob (`@vercel/blob` SDK).
Supports per-blob public/private access, automatic overwrite, and prefix-based listing.
Configure via `OA_VERCEL_BLOB_TOKEN` (required) plus optional access/cache env vars,
or call `createVercelBlobStorageAdapter(config)` directly.

## Quick Start

```ts
import adapter from '@openagentry/adapter-storage-vercel-blob';
// OA_VERCEL_BLOB_TOKEN must be set in the environment.
const obj = await adapter.put('my/file.txt', 'hello world', { public: true });
console.log(obj.url); // stable public URL
const got = await adapter.get('my/file.txt'); // { key, url, size, contentType, uploadedAt }
await adapter.delete('my/file.txt');
for await (const item of adapter.list('my/')) { console.log(item.key); }
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OA_VERCEL_BLOB_TOKEN` | yes | — | Read-write token from Vercel dashboard |
| `OA_VERCEL_BLOB_DEFAULT_ACCESS` | no | `private` | `public` or `private` when `opts.public` is omitted |
| `OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC` | no | `2592000` | Cache-Control max-age (seconds) for public blobs |
| `OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE` | no | `0` | Cache-Control max-age (seconds) for private blobs |
