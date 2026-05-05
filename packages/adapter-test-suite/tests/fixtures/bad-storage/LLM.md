# fixture-bad-storage (LLM context)

Intentionally broken test fixture. NOT for production. Used to exercise failure paths in the conformance suite.

## Operations

- `put` — stub; throws plain `Error` on empty key (NOT `AgentryError`, by design).
- `get` — always returns null.
- `delete` — no-op.
- `list` — returns an empty async iterable regardless of prefix.

## Common pitfalls

- This adapter exists only for the conformance suite's negative tests.
- Do NOT use as a template for real adapters.
