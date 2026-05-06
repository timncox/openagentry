# Changelog

## 0.1.0-alpha.0 — 2026-05-06

- First release. Implements `LlmAdapter` from `@openagentry/core` against
  local `claude` / `codex` / `gemini` CLIs (operator flavor).
- Three lifecycle hooks: `init` (binary resolution), `refresh` (no-op),
  `healthcheck` (`--version` probe).
- Six stable error codes (`E_LLM_CLI_NOT_FOUND`, `E_LLM_CLI_AUTH`,
  `E_LLM_CLI_TIMEOUT`, `E_LLM_CLI_NONZERO`, `E_LLM_CLI_PARSE`,
  `E_LLM_CLI_SCHEMA`).
- Default export constructed from `OA_LLM_CLI` (default `claude`) and
  `OA_LLM_CLI_BIN` env vars.
- Conformance suite runs ungated in CI via stub Node-script fixtures.
