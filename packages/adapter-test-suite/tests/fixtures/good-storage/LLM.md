# fixture-good-storage (LLM context)

In-memory test fixture. NOT for production. Implements every `StorageAdapter` operation against a process-local Map.

## Operations

- `put(key, body, opts?)` — stores body, returns `{ key, url, size, contentType, uploadedAt }`.
- `get(key)` — returns the stored object metadata or `null`.
- `delete(key)` — removes the key (no-op if absent).
- `list(prefix?)` — async-iterates stored objects matching the prefix.

## Common pitfalls

- Empty keys throw `AgentryError(E_STORAGE_BAD_KEY)`.
- State is process-local; restarts wipe all entries.
- `url` is a stub `mem://` scheme — not resolvable by HTTP.
