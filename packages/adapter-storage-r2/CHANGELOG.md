# Changelog

## 0.1.0-alpha.0 (2026-05-06)

Initial alpha release.

- All 4 `StorageAdapter` operations (`put`, `get`, `delete`, `list`) over R2's S3-compatible API via `aws4fetch`.
- Public/private URL strategy with `opts.public` round-trip via custom metadata (`x-amz-meta-oa-public: 1`).
- 6 stable error codes: `E_R2_NOT_FOUND`, `E_R2_PERMISSION`, `E_R2_INVALID_KEY`, `E_R2_NETWORK`, `E_R2_PUBLIC_NOT_CONFIGURED`, `E_R2_UPSTREAM`.
- Conformance via MinIO Testcontainers (8 checks: 4 universal + 3 storage functional + 1 new public-url-roundtrip).
- Default export reads `OA_R2_*` env vars lazily.
- Content-Type sniffing for 16 common extensions; sane Cache-Control defaults split by public/private.

### Known limits in this release

- Single-PUT only (~5 GB max).
- No multipart upload.
- No range / partial GET reads.
- No Workers binding driver.
- No `agentry doctor` integration.
- No retry layer for transient 5xx.

All deferred to follow-up plans.
