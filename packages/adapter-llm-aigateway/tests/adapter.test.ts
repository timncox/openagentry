import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAigatewayLlmAdapter } from '../src/adapter.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

const { generateText: mockGenerate } = await import('ai');

beforeEach(() => {
  vi.mocked(mockGenerate).mockReset();
});

describe('createAigatewayLlmAdapter', () => {
  it('returns a frozen adapter with category/id', () => {
    const a = createAigatewayLlmAdapter({ apiKey: 'k' });
    expect(a.category).toBe('llm');
    expect(a.id).toBe('llm-aigateway');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('exposes getCapabilities with the v0 surface', () => {
    const caps = createAigatewayLlmAdapter({ apiKey: 'k' }).getCapabilities();
    expect(caps).toEqual({
      streaming: true,
      tools: false,
      vision: false,
      embeddings: false,
      runtime: true,
    });
  });

  it('all 3 op methods exist', () => {
    const a = createAigatewayLlmAdapter({ apiKey: 'k' });
    expect(typeof a.listModels).toBe('function');
    expect(typeof a.generate).toBe('function');
    expect(typeof a.stream).toBe('function');
  });

  it('rejects invalid config at construction time', () => {
    expect(() => createAigatewayLlmAdapter({ apiKey: '' })).toThrow();
  });

  it('binds generate to the configured apiKey', async () => {
    vi.mocked(mockGenerate).mockResolvedValue({
      text: 'hi',
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof mockGenerate>>);
    const a = createAigatewayLlmAdapter({ apiKey: 'k', defaultModel: 'a/b' });
    const out = await a.generate('p');
    expect(out.text).toBe('hi');
    expect(process.env.AI_GATEWAY_API_KEY).toBe('k');
  });
});
