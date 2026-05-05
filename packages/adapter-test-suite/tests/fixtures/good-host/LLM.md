# fixture-good-host (LLM context)

In-memory test fixture. NOT for production. Implements every `HostAdapter` operation against process-local Maps.

## Operations

- `createProject` / `destroyProject` — track projects in a Map keyed by `hostId`.
- `deploy` / `rollback` — deployments stored per project; `rollback` throws `AgentryError` (`E_DEPLOYMENT_NOT_FOUND`) when the id is unknown.
- `setEnv` / `getEnv` — env vars stored per `(hostId, env)` pair; `setEnv` is fully idempotent (overwrites identically).
- `exportState` / `importState` — round-trips project + envs + domain list.

## Common pitfalls

- This adapter is NOT persistent — restarts wipe all state.
- `attachDomain` always returns `status: "active"` synchronously; no DNS verification.
- `logs` returns an empty async iterable.
- CJS adapters must export the adapter both as `module.exports = adapter` AND `module.exports.default = adapter` so ESM dynamic-import sees a `.default`. TypeScript adapters using `export default` get this for free.
