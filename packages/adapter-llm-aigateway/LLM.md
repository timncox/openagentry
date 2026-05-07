# @openagentry/adapter-llm-aigateway

LLM adapter for Vercel AI Gateway. Routes generation and streaming requests through the AI Gateway endpoint using the `ai` SDK. Full docs land in Task 12.

## Setup

Set `OA_AIGATEWAY_API_KEY` to your Vercel AI Gateway API key (required). Optionally set `OA_AIGATEWAY_DEFAULT_MODEL` (e.g., `anthropic/claude-opus-4.6`) and `OA_AIGATEWAY_BASE_URL` to override the gateway endpoint.

## Usage

The adapter exposes `listModels()`, `generate(prompt, opts?)`, and `stream(prompt, opts?)`. Pass `opts.system` to set a system prompt, `opts.model` to override the default model per-call, and `opts.maxTokens` / `opts.temperature` for generation parameters.
