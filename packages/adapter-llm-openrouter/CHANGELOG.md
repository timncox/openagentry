# Changelog

## 0.1.0-alpha.0 (2026-05-07)

- Initial alpha release.
- LlmAdapter implementation backed by OpenRouter's OpenAI-compatible REST API (plain fetch, no SDK).
- Six stable error codes (`E_OPENROUTER_*`).
- Optional app attribution headers (`HTTP-Referer`, `X-OpenRouter-Title`).
- Lazy default export from `OA_OPENROUTER_*` env vars.
