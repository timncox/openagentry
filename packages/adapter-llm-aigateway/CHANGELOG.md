# Changelog

## 0.1.0-alpha.0 — 2026-05-07

Initial alpha release. Implements `LlmAdapter` against Vercel AI Gateway via the `ai` SDK. Three methods: listModels (plain fetch to `/v1/models`), generate, stream. No default model — operator must specify. Six stable error codes.
