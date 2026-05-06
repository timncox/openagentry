# @openagentry/adapter-llm-cli

OpenAgentry `LlmAdapter` implementation that shells out to local
`claude` / `codex` / `gemini` CLIs. The operator flavor of LLM access —
no API keys required at the adapter level. The host CLI handles auth.

See [LLM.md](./LLM.md) for agent-facing usage.

## Install

```bash
pnpm add @openagentry/adapter-llm-cli
```

## Use

```ts
import createLlm, { createLlmCliAdapter } from '@openagentry/adapter-llm-cli';

// Default export reads OA_LLM_CLI / OA_LLM_CLI_BIN env vars.
const llm = createLlm;

// Or construct explicitly:
const llm2 = createLlmCliAdapter({ cli: 'claude' });

const { text } = await llm.generate('What is 2+2?');
```

License: Apache-2.0.
