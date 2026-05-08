# @openagentry/adapter-llm-openrouter

Third concrete `LlmAdapter` for OpenAgentry — runtime LLM access via OpenRouter (plain `fetch` against their OpenAI-compatible REST API). Joins `@openagentry/adapter-llm-cli` (operator/CLI) and `@openagentry/adapter-llm-aigateway` (runtime/SDK).

## Install

```bash
npm install @openagentry/adapter-llm-openrouter
# or
pnpm add @openagentry/adapter-llm-openrouter
```

## Quick start

```ts
import llm from '@openagentry/adapter-llm-openrouter';

// Set OA_OPENROUTER_API_KEY in env, then:
const models = await llm.listModels();
const out = await llm.generate('Hello!', { model: 'openai/gpt-5.2' });
console.log(out.text);
```

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `OA_OPENROUTER_API_KEY` | yes | OpenRouter API key (https://openrouter.ai/keys) |
| `OA_OPENROUTER_DEFAULT_MODEL` | no | Default model when `opts.model` unset |
| `OA_OPENROUTER_BASE_URL` | no | Override base URL (default: `https://openrouter.ai/api/v1`) |
| `OA_OPENROUTER_APP_URL` | no | Sent as `HTTP-Referer` (opt-in attribution) |
| `OA_OPENROUTER_APP_TITLE` | no | Sent as `X-OpenRouter-Title` (opt-in attribution) |

## Operator vs runtime

This adapter is the **runtime** flavor — for deployed apps that call the LLM at request time. For build-time/operator-side calls (no API key needed), use `@openagentry/adapter-llm-cli`.

## What's NOT in v0

- Tool/function-calling support
- Vision/image inputs
- Embeddings endpoint
- Provider-routing preferences (`route`, `provider: {...}` body params; pass `model: 'openrouter/auto'` for auto-routing instead)
- Retry logic on transient 5xx
- Cost tracking from response headers
- `Cache-Control` parsing helpers (no equivalent need on this adapter)

## Documentation

- LLM-targeted reference: [LLM.md](./LLM.md)
- License: Apache-2.0
- Issues: https://github.com/timncox/openagentry/issues

## Architecture notes

Plain `fetch` everywhere — no `ai` / `openai` / `@openrouter/sdk` dependency. SSE streaming uses a hand-rolled line-buffered parser (`src/sse.ts`). Mocking in tests uses pure MSW (no `vi.mock` shenanigans, since `globalThis.fetch` is the only external call surface).

The deliberately-different transport shape (CLI shell-out / SDK wrapper / raw HTTP) across the three LLM adapters strengthens the abstraction proof for the category — the same `LlmAdapter` interface fits all three.
