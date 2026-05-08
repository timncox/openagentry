# @openagentry/adapter-llm-openrouter

Runtime LLM access via OpenRouter — plain `fetch` against their OpenAI-compatible REST API at `https://openrouter.ai/api/v1`. No SDK dependency.

## Setup

Required env: `OA_OPENROUTER_API_KEY` — OpenRouter API key. Get one from https://openrouter.ai/keys.

Optional env:
- `OA_OPENROUTER_DEFAULT_MODEL` — default model id when `opts.model` is unspecified. Format: `'provider/model'` (e.g., `'openai/gpt-5.2'`, `'anthropic/claude-opus-4.6'`, `'openrouter/auto'`). **No built-in default — set this or pass `opts.model`.**
- `OA_OPENROUTER_BASE_URL` — base URL. Default: `https://openrouter.ai/api/v1`.
- `OA_OPENROUTER_APP_URL` — optional. When set, sent as `HTTP-Referer` (OpenRouter leaderboard attribution).
- `OA_OPENROUTER_APP_TITLE` — optional. When set, sent as `X-OpenRouter-Title` (leaderboard).

## API

```ts
import llm from '@openagentry/adapter-llm-openrouter';

const models = await llm.listModels();
const out = await llm.generate('Hello!', { model: 'openai/gpt-5.2' });
for await (const chunk of llm.stream('Count to ten.')) {
  if (chunk.type === 'text') process.stdout.write(chunk.text);
  if (chunk.type === 'done') console.log('\n');
  if (chunk.type === 'error') console.error(chunk.message);
}
```

- `listModels()` — `GET /models`. Returns `LlmModel[]` (`id`, `label`, `contextWindow`, `capabilities`).
- `generate(prompt, opts?)` — `POST /chat/completions`. Returns `{ text, model, usage? }`.
- `stream(prompt, opts?)` — SSE stream. Yields `{type:'text'} | {type:'done'} | {type:'error'}`.

## Model id format

OpenRouter uses `'provider/model'`: `openai/gpt-5.2`, `anthropic/claude-opus-4.6`, `google/gemini-2.5-pro`, `openrouter/auto`. See `listModels()` or https://openrouter.ai/models.

## App attribution (opt-in)

Set `appUrl`/`appTitle` in config to send `HTTP-Referer` + `X-OpenRouter-Title` headers for leaderboard credit. Off by default.

## 5 important gotchas

1. **No default model.** Must pass `opts.model` or set `OA_OPENROUTER_DEFAULT_MODEL`. Without either: `E_OPENROUTER_CONFIG_INVALID`.
2. **No tool calls / vision / embeddings in v0.** Only the 3 LlmAdapter methods.
3. **Stream errors yield error chunks, not throws.** Check `chunk.type === 'error'` in your loop.
4. **Attribution is opt-in.** No headers sent unless you set `appUrl` / `appTitle`.
5. **`openrouter/auto` is a valid model string.** OpenRouter routes to the best-fit model automatically.

## Error codes (6)

- `E_OPENROUTER_NOT_FOUND` — HTTP 404, or HTTP 400 with `{error:{code:'model_not_found'}}`.
- `E_OPENROUTER_AUTH` — HTTP 401, 403.
- `E_OPENROUTER_RATE_LIMIT` — HTTP 429. `context.retryAfter` set when `Retry-After` header present.
- `E_OPENROUTER_NETWORK` — fetch threw (TypeError, ECONNREFUSED, abort).
- `E_OPENROUTER_UPSTREAM` — HTTP 5xx + other 4xx.
- `E_OPENROUTER_CONFIG_INVALID` — env-var or schema validation failure, or no model resolvable.

All errors are `AgentryError` instances with `adapter: 'llm-openrouter'`, a stable `code`, a `phase`, and a `suggestedFix`.

## Cookbook

```ts
// Generate with system prompt
const r = await llm.generate('Tell me a joke.', {
  model: 'anthropic/claude-opus-4.6',
  system: 'You are a stand-up comedian.',
  temperature: 0.9,
  maxTokens: 200,
});

// Direct factory (multi-tenant)
import { createOpenrouterLlmAdapter } from '@openagentry/adapter-llm-openrouter';
const tenant = createOpenrouterLlmAdapter({
  apiKey: tenantApiKey,
  defaultModel: 'openai/gpt-5.2',
  appUrl: 'https://tenant.my-app.example.com',
  appTitle: `Tenant: ${tenantId}`,
});
```
