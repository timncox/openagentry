/**
 * LlmAdapter — provides LLM completions to operator scripts and runtime apps.
 *
 * Two flavors:
 * - **CLI flavor** (e.g. @openagentry/adapter-llm-cli): shells out to local
 *   claude/codex/gemini CLI for operator-side calls (no API key needed).
 * - **Runtime flavor** (e.g. @openagentry/adapter-llm-aigateway,
 *   @openagentry/adapter-llm-openrouter): for deployed apps that need
 *   programmatic API access.
 *
 * Both implement the same interface. Scaffolds use `useAdapter('llm')` and
 * the runtime resolves to whichever is configured.
 *
 * @module
 */

export interface LlmModel {
  id: string;
  label: string;
  contextWindow: number;
  capabilities: {
    tools?: boolean;
    streaming?: boolean;
    vision?: boolean;
  };
}

export interface LlmGenerateOpts {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** System prompt prepended to the conversation. */
  system?: string;
}

export interface LlmGenerateResult {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export type LlmStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; message: string };

export interface LlmAdapter {
  readonly category: 'llm';
  readonly id: string;

  listModels(): Promise<LlmModel[]>;
  generate(prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult>;
  stream(prompt: string, opts?: LlmGenerateOpts): AsyncIterable<LlmStreamChunk>;
}
