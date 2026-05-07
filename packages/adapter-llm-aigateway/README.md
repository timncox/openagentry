# @openagentry/adapter-llm-aigateway

[`LlmAdapter`](https://github.com/timncox/openagentry/tree/main/packages/core) implementation backed by [Vercel AI Gateway](https://vercel.com/ai-gateway) via the official [`ai`](https://www.npmjs.com/package/ai) SDK.

Pairs naturally with [`@openagentry/adapter-host-vercel`](../adapter-host-vercel) and [`@openagentry/adapter-storage-vercel-blob`](../adapter-storage-vercel-blob) for projects deployed on Vercel; can be used standalone with any gateway-bearing client.

## Install

```bash
pnpm add @openagentry/adapter-llm-aigateway
```

## Quick start

```ts
import llm from '@openagentry/adapter-llm-aigateway';

const models = await llm.listModels();
const r = await llm.generate('Say hi!', { model: 'anthropic/claude-opus-4.6' });
console.log(r.text);
```

The default export reads `OA_AIGATEWAY_API_KEY` from `process.env` lazily on first call. Or construct an adapter explicitly:

```ts
import { createAigatewayLlmAdapter } from '@openagentry/adapter-llm-aigateway';

const llm = createAigatewayLlmAdapter({
  apiKey: process.env.MY_KEY!,
  defaultModel: 'anthropic/claude-opus-4.6',
});
```

## Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `OA_AIGATEWAY_API_KEY` | yes | — | Vercel AI Gateway key (Vercel dashboard → AI Gateway → Keys). |
| `OA_AIGATEWAY_DEFAULT_MODEL` | no | — | Model id (`'provider/model'`). No built-in default. |
| `OA_AIGATEWAY_BASE_URL` | no | `https://ai-gateway.vercel.sh/v1` | Gateway base URL. |

We use `OA_AIGATEWAY_API_KEY` (not Vercel's own `AI_GATEWAY_API_KEY`) to keep adapter env naming consistent with the rest of OpenAgentry. The adapter sets `AI_GATEWAY_API_KEY` from your `OA_AIGATEWAY_API_KEY` automatically before calling the SDK, so the SDK reads the right value.

## Operator vs runtime flavors

- **Operator flavor** (`@openagentry/adapter-llm-cli`) — shells out to local `claude`/`codex`/`gemini` CLIs. No API key. Build-time only.
- **Runtime flavor** (this package) — programmatic gateway access. Requires API key. Works in deployed functions.

Both implement the same `LlmAdapter` interface; pick the one your runtime needs.

## What's NOT in v0

- Tool / function calling
- Vision / multimodal inputs
- Embeddings (separate `EmbeddingsAdapter` in future)
- `system` as message-array (string only)
- Provider-specific options (Anthropic prompt caching, OpenAI logit_bias, etc.)
- Web search / observability / cost tracking

For these features today, drop down to the raw `ai` SDK directly.

## LLM-facing docs

See [`LLM.md`](./LLM.md) — the doc shipped to LLM consumers via `package.json#openagentry.llmDocs`.

## License

Apache-2.0
