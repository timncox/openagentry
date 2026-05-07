# @openagentry/adapter-storage-r2

Storage adapter for Cloudflare R2 (S3-compatible API). Implements the OpenAgentry `StorageAdapter` interface. Full documentation will be expanded in the next task.

## Configuration

Set the following environment variables before use:

- `OA_R2_ACCOUNT_ID` — Cloudflare account ID (32-char hex string)
- `OA_R2_ACCESS_KEY_ID` — R2 API token access key
- `OA_R2_SECRET_ACCESS_KEY` — R2 API token secret key
- `OA_R2_BUCKET` — Bucket name
- `OA_R2_PUBLIC_BASE_URL` — (optional) Public base URL for public-read objects
- `OA_R2_PRESIGN_TTL` — (optional) Presigned URL TTL in seconds (default: 3600)
- `OA_R2_ENDPOINT` — (optional) Custom S3-compatible endpoint (for testing with MinIO)

## Usage

Import the lazy default export (reads env vars on first call) or use `createR2StorageAdapter(config)` for explicit configuration.

```ts
import adapter from '@openagentry/adapter-storage-r2';

await adapter.put('path/to/file.txt', 'hello world');
const obj = await adapter.get('path/to/file.txt');
await adapter.delete('path/to/file.txt');
for await (const item of adapter.list('path/')) { console.log(item.key); }
```

All errors are thrown as `AgentryError` with an `E_`-prefixed code and a storage-phase classification (`write`, `read`, `delete`, `list`).
