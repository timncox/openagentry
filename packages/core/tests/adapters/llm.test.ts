import { describe, expectTypeOf, it } from 'vitest';
import type {
  LlmAdapter,
  LlmGenerateOpts,
  LlmGenerateResult,
  LlmStreamChunk,
  LlmModel,
} from '../../src/adapters/llm.js';

describe('LlmAdapter type contract', () => {
  it('declares category="llm"', () => {
    expectTypeOf<LlmAdapter['category']>().toEqualTypeOf<'llm'>();
  });

  it('generate takes prompt + opts → Promise<LlmGenerateResult>', () => {
    expectTypeOf<LlmAdapter['generate']>().toEqualTypeOf<
      (prompt: string, opts?: LlmGenerateOpts) => Promise<LlmGenerateResult>
    >();
  });

  it('stream returns AsyncIterable<LlmStreamChunk>', () => {
    expectTypeOf<ReturnType<LlmAdapter['stream']>>().toEqualTypeOf<AsyncIterable<LlmStreamChunk>>();
  });

  it('listModels returns Promise<LlmModel[]>', () => {
    expectTypeOf<LlmAdapter['listModels']>().returns.toEqualTypeOf<Promise<LlmModel[]>>();
  });

  it('LlmModel has id, label, contextWindow, capabilities', () => {
    expectTypeOf<LlmModel>().toEqualTypeOf<{
      id: string;
      label: string;
      contextWindow: number;
      capabilities: { tools?: boolean; streaming?: boolean; vision?: boolean };
    }>();
  });

  it('LlmStreamChunk discriminated by type', () => {
    expectTypeOf<LlmStreamChunk>().toEqualTypeOf<
      | { type: 'text'; text: string }
      | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }
      | { type: 'error'; message: string }
    >();
  });
});
