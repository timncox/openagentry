# @openagentry/adapter-llm-aigateway

Runtime LLM access via Vercel AI Gateway (the `ai` SDK). Pairs naturally with `@openagentry/adapter-host-vercel` for projects deployed on Vercel.

## Setup

Required env: `OA_AIGATEWAY_API_KEY` — Vercel AI Gateway key. Get one from the Vercel dashboard: AI Gateway → Keys.

Optional env:
- `OA_AIGATEWAY_DEFAULT_MODEL` — default model id when `opts.model` is unspecified. Format: `'provider/model'` (e.g., `'anthropic/claude-opus-4.6'`, `'openai/gpt-5.4'`). **No built-in default — set this or pass `opts.model`.**
- `OA_AIGATEWAY_BASE_URL` — gateway base URL. Default: `https://ai-gateway.vercel.sh/v1`.

## API

```ts
import llm from '@openagentry/adapter-llm-aigateway';

const models = await llm.listModels();        // LlmModel[]
const out = await llm.generate('Hello!', { model: 'anthropic/claude-opus-4.6' });
console.log(out.text);
for await (const chunk of llm.stream('Count to ten.')) {
  if (chunk.type === 'text') process.stdout.write(chunk.text);
  if (chunk.type === 'done') console.log('\n', chunk.usage);
  if (chunk.type === 'error') console.error(chunk.message);
}
```

- `listModels()` — returns the gateway's available models (id, label, contextWindow, capabilities).
- `generate(prompt, opts?)` — single-shot. Returns `{ text, model, usage? }`.
- `stream(prompt, opts?)` — async iterable yielding `{type:'text'} | {type:'done'} | {type:'error'}` chunks. Errors during streaming yield an error chunk; they do NOT throw mid-iteration.

## Model id format

Always `'provider/model'`:
- `anthropic/claude-opus-4.6`, `anthropic/claude-sonnet-4.6`
- `openai/gpt-5.4`, `openai/o3-mini`
- `xai/grok-4.1-fast-non-reasoning`, `google/gemini-2.5-pro`

The full list: see `listModels()` or the Vercel AI Gateway models page.

## 4 important gotchas

1. **No default model.** Must pass `opts.model` or set `OA_AIGATEWAY_DEFAULT_MODEL`. Calling `generate(prompt)` without either throws `E_AIGATEWAY_CONFIG_INVALID`.
2. **No tool calls / vision / embeddings in v0.** Use the raw `ai` SDK if you need them — the adapter only exposes the 3 LlmAdapter methods.
3. **Stream errors yield error chunks, not throws.** Caller's `for await` loop must check `chunk.type === 'error'`. Mid-iteration SDK failures do not surface as exceptions.
4. **`OA_AIGATEWAY_API_KEY` is OpenAgentry's name.** Vercel may set `AI_GATEWAY_API_KEY` automatically on the platform; the adapter copies the value through internally — operators just set OA_AIGATEWAY_API_KEY in their env.

## Error codes (6)

- `E_AIGATEWAY_NOT_FOUND` — model not in gateway, or 404 from listModels.
- `E_AIGATEWAY_AUTH` — bad/missing API key (401/403, LoadAPIKeyError).
- `E_AIGATEWAY_RATE_LIMIT` — 429. `context.retryAfter` set if `Retry-After` header present.
- `E_AIGATEWAY_NETWORK` — couldn't reach `ai-gateway.vercel.sh`. Check connectivity.
- `E_AIGATEWAY_UPSTREAM` — 5xx, malformed responses, unknown SDK errors.
- `E_AIGATEWAY_CONFIG_INVALID` — env vars missing/invalid (init phase), or no model resolvable at call time.

All errors are `AgentryError` instances with `adapter: 'llm-aigateway'`, a stable `code`, a relevant `phase` (`'listModels'`/`'generate'`/`'stream'`/`'init'`), and a `suggestedFix`.

## Cookbook

```ts
// Generate with system prompt + temperature.
const r = await llm.generate('Tell me a joke.', {
  model: 'anthropic/claude-opus-4.6',
  system: 'You are a stand-up comedian.',
  temperature: 0.9,
  maxTokens: 200,
});
return r.text;
```
