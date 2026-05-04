# Changelog

## 0.1.0-alpha.0 (unreleased)

Initial draft. Public SDK contract:

- Adapter interfaces: HostAdapter, DatabaseAdapter, AuthAdapter, EmailAdapter,
  LlmAdapter, StorageAdapter, DomainAdapter, RepoAdapter, WikiAdapter
- Plugin protocol: manifest schema (zod), version helpers
- Runtime: AgentryError, registerAdapter, useAdapter, AdapterContext
