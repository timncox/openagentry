# @openagentry/adapter-llm-cli — agent guide

This adapter satisfies `LlmAdapter` from `@openagentry/core` by shelling
out to one of three local CLIs: `claude`, `codex`, or `gemini`. It is the
**operator flavor** of LLM access — for build-time scripts, not for
deployed apps. Auth is the CLI's responsibility (`claude login`, etc.);
this adapter spawns the binary inheriting the parent process env.

## Install + configure

```ts
import createLlm, { createLlmCliAdapter } from '@openagentry/adapter-llm-cli';

const llm = createLlmCliAdapter({
  cli: 'claude',
  // Optional:
  binPath: '/usr/local/bin/claude', // override PATH lookup
  timeoutMs: 120_000,                // default 120s
  env: { ANTHROPIC_API_KEY: 'sk-...' }, // extra env for child process
});
```

The default export reads `OA_LLM_CLI` (default `claude`) and
`OA_LLM_CLI_BIN` (optional binPath override) from `process.env`.

## Methods

`listModels()` returns a hardcoded list per CLI. `generate(prompt, opts)`
runs the CLI to completion and returns text + model + optional usage.
`stream(prompt, opts)` is an async iterable that yields text chunks then
exactly one done chunk; if the consumer breaks early, the adapter sends
SIGTERM to the child process. `LlmGenerateOpts.system` is forwarded to
the CLI's system-prompt flag where supported, or prepended to the user
prompt with a delimiter.

## Errors

All failures throw `AgentryError` with a code from `LLM_CLI_ERROR_CODES`:
binary missing → `E_LLM_CLI_NOT_FOUND`; CLI auth failure stderr →
`E_LLM_CLI_AUTH`; timeout → `E_LLM_CLI_TIMEOUT`; non-zero exit →
`E_LLM_CLI_NONZERO`; parse failure → `E_LLM_CLI_PARSE`; bad config →
`E_LLM_CLI_SCHEMA`. Phases are `'init' | 'listModels' | 'generate' |
'stream'`.
