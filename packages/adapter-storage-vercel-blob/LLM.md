# @openagentry/adapter-storage-vercel-blob

Object storage backed by Vercel Blob via the official `@vercel/blob` SDK. Pairs naturally with `@openagentry/adapter-host-vercel`.

## Setup

Required env: `OA_VERCEL_BLOB_TOKEN` — Vercel Blob read-write token. Get one from the Vercel dashboard: Storage → Blob → Tokens.

Optional env:
- `OA_VERCEL_BLOB_DEFAULT_ACCESS` — `"private"` (default) or `"public"`. Sets what `put({})` (no `public` opt) does.
- `OA_VERCEL_BLOB_CACHE_MAX_AGE_PUBLIC` — seconds; default `31536000` (1 year). Default Cache-Control max-age for public uploads.
- `OA_VERCEL_BLOB_CACHE_MAX_AGE_PRIVATE` — seconds; default `3600` (1 hour). Default for private uploads.

## API

```ts
import storage from '@openagentry/adapter-storage-vercel-blob';

await storage.put('uploads/avatar.png', bytes, { public: true });
const meta = await storage.get('uploads/avatar.png');     // metadata or null
await storage.delete('uploads/avatar.png');
for await (const blob of storage.list('uploads/')) { ... }
```

- `put(key, body, opts?)` — uploads the body. Returns `{ key, url, size, contentType, uploadedAt }`. Single-PUT only (no multipart in v0). `addRandomSuffix: false` and `allowOverwrite: true` always — your key IS the pathname.
- `get(key)` — returns blob metadata or `null` if missing. **Returns metadata only, not bytes.** For bytes, use the `@vercel/blob` SDK's `get()` directly.
- `delete(key)` — idempotent on missing keys (no error if blob doesn't exist).
- `list(prefix?)` — `AsyncIterable<StorageObject>`, cursor-paginated under the hood. **Does not include per-blob `contentType`** (Vercel's list response omits it; call `get(key)` for it).

## opts.public semantics (three-way)

- `opts.public === true` → `access: 'public'`. Returned URL is `https://<store>.public.blob.vercel-storage.com/<key>` and is anonymously fetchable.
- `opts.public === false` → `access: 'private'`. URL is `https://<store>.private.blob.vercel-storage.com/<key>` — fetching requires the token.
- `opts.public === undefined` → uses `OA_VERCEL_BLOB_DEFAULT_ACCESS` (default `'private'`).

## 4 important gotchas

1. **Private blob URLs aren't unauthenticated-fetchable.** `StorageObject.url` for a private blob requires the read-write token to fetch. To deliver a private blob to a browser, proxy through a function that streams the body via SDK `get()`. (R2 hands out presigned URLs for any anonymous fetch; Vercel does not.)
2. **`opts.meta` is ignored.** Vercel Blob has no custom-metadata equivalent to S3's `x-amz-meta-*`. If you need metadata round-trip, use `@openagentry/adapter-storage-r2`.
3. **`list()` doesn't include per-blob `contentType`.** Vercel's list endpoint omits it. Call `get(blob.key)` to get the contentType.
4. **`opts.cacheControl` only honors `max-age`.** The adapter parses `max-age=N` from the header string and passes the seconds to Vercel's `cacheControlMaxAge`. Other directives (`no-cache`, `private`, `immutable`) are NOT propagated.

## Error codes (6)

- `E_VERCEL_BLOB_NOT_FOUND` — head/get/delete reached a nonexistent blob (rarely surfaces; `get()` returns `null` instead).
- `E_VERCEL_BLOB_PERMISSION` — token lacks access. Re-check `OA_VERCEL_BLOB_TOKEN` is read-write and store-scoped.
- `E_VERCEL_BLOB_INVALID_KEY` — empty pathname, or leading `/`.
- `E_VERCEL_BLOB_NETWORK` — couldn't reach `blob.vercel-storage.com`. Check connectivity.
- `E_VERCEL_BLOB_UPSTREAM` — Vercel returned an unexpected error (5xx, store suspended, store deleted, or unrecognized SDK error).
- `E_VERCEL_BLOB_CONFIG_INVALID` — env vars missing or schema-invalid (init phase).

All errors are `AgentryError` instances with `adapter: 'storage-vercel-blob'`, a stable `code`, a relevant `phase` (`'write'`/`'read'`/`'delete'`/`'list'`/`'init'`), and a `suggestedFix`.

## Cookbook

```ts
// Save a public upload, return its anonymously-fetchable URL.
const out = await storage.put(`uploads/${userId}/${fileName}`, fileBytes, {
  public: true,
  contentType: 'image/png',
  cacheControl: 'public, max-age=86400',
});
return out.url;
```
