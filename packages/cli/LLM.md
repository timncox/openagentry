# @openagentry/cli (LLM context)

The `agentry` binary. AI-friendly: every command supports `--json` and structured errors.

## Commands shipped at v0.1.0-alpha.0

- `agentry version` — print CLI + protocol version
- `agentry help [command]` — usage
- `agentry doctor` — environment + workspace healthcheck
- `agentry list` — installed plugins (from workspace config)
- `agentry capabilities` — what adapters are registered after loading plugins

## Common pitfalls

- Errors are AgentryError instances. With `--json`, stderr is structured JSON; otherwise human-readable.
- The CLI does not install plugins yet (Plan G). `list` reads what's declared in `<workspace>/.agentry/workspace.json`; if no workspace is configured, it returns an empty list.
