# @openagentry/mcp

The `agentry-mcp` meta-MCP server — exposes every [agentry CLI command](https://npmjs.com/package/@openagentry/cli) as an MCP tool. Built on top of `@openagentry/cli`'s dispatcher so the CLI surface and the MCP surface are guaranteed equivalent.

## Install

```bash
npm install -g @openagentry/mcp
# or
pnpm add -g @openagentry/mcp
```

## Use

Configure your MCP client (Claude Desktop, Claude Code, Codex, etc.) to spawn `agentry-mcp` over stdio:

```json
{
  "mcpServers": {
    "agentry": {
      "command": "agentry-mcp"
    }
  }
}
```

The server advertises one tool per registered agentry command:

- `agentry_version`
- `agentry_help`
- `agentry_doctor`
- `agentry_list`
- `agentry_capabilities`

Each tool accepts an `args` array of strings (CLI-style argv after the command name) and returns the command's `--json` output as MCP content.

## Status

Alpha. v0.1.0-alpha.0 ships the five read-only commands. Install / auth / new / init land in subsequent plans (G/H).

## License

[Apache-2.0](./LICENSE)
