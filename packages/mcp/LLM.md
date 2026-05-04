# @openagentry/mcp (LLM context)

The `agentry-mcp` server makes every CLI command callable as an MCP tool. The CLI and MCP surfaces are mechanically guaranteed equivalent — when a new `agentry` command lands in `@openagentry/cli`, this server picks it up automatically via the shared `commands` registry.

## Tool naming

`agentry_<command>`. The MCP tool name is the CLI command name, lowercased, prefixed `agentry_`. Hyphens and underscores are preserved.

## Tool input

```json
{
  "args": ["--scope", "workspace"]
}
```

`args` is the argv tail (everything after `agentry <command>`). Unrecognized flags are passed through; the dispatcher decides what to do with them.

## Tool output

The dispatcher always runs in `--json` mode for MCP calls. The result is MCP `text` content containing the JSON the command emitted on stdout. Errors are MCP error responses with the `AgentryError` JSON in the `data` field.

## Common pitfalls

- The server runs in the AI client's spawn context; `cwd` defaults to wherever the client launched it. Use `agentry_list`/`agentry_capabilities` from inside the workspace dir, or set the client's `cwd`.
- Capability install (Plan G) is not yet wired — `agentry_install` does not exist as a tool at v0.1.0-alpha.0.
