# @openagentry/cli

The `agentry` CLI — operator surface for [OpenAgentry](https://openagentry.dev).

## Install

```bash
npm install -g @openagentry/cli
# or
pnpm add -g @openagentry/cli
```

## Quick start

```bash
agentry version
agentry doctor          # environment + workspace healthcheck
agentry list            # plugins declared in this workspace
agentry capabilities    # adapters available right now
agentry help [command]  # detailed help
```

## Output modes

Every command accepts `--json` for machine-readable output. Errors are always
structured `AgentryError` instances (with `code`, `phase`, `suggestedFix`,
`docs`, `context`) — in JSON mode they go to stderr as compact JSON, in
text mode as a multi-line human-readable block.

## Workspace model (v0)

- `~/.agentry/config.json` — operator-level (active workspace path, telemetry pref)
- `<workspace>/.agentry/workspace.json` — plugin set, default env

`agentry list` and `agentry capabilities` walk upward from `cwd` looking for
`.agentry/workspace.json`. If none is found, both report empty.

## Status

Alpha. v0.1.0-alpha.0 ships the dispatcher, plugin loader, and read-only
commands (version/help/doctor/list/capabilities). Install/auth/new/init land
in subsequent plans.

## License

[Apache-2.0](./LICENSE)
