# @openagentry/core (LLM context)

Public SDK. Defines interfaces only — implementations live in `@openagentry/adapter-*` packages.

## Key exports

- `HostAdapter`, `DatabaseAdapter`, `AuthAdapter`, `EmailAdapter`, `LlmAdapter`,
  `StorageAdapter`, `DomainAdapter`, `RepoAdapter`, `WikiAdapter` — adapter interfaces
- `PluginManifest`, `pluginManifestSchema` (zod) — plugin manifest validation
- `PROTOCOL_VERSION`, `isProtocolCompatible` — version helpers
- `AgentryError`, `isAgentryError` — structured error type
- `useAdapter<T>(category)` — runtime resolver (throws if no adapter registered for category)

## Common pitfalls

- Adapters never import vendor SDKs from `@openagentry/core`. Vendor packages live in `@openagentry/adapter-<vendor>`.
- All adapter ops must be idempotent (see `aiFriendly` block in plugin manifest).
- Errors must be `AgentryError` instances, not plain `Error`. The framework introspects them.
