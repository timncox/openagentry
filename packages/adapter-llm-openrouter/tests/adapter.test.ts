import { describe, it, expect } from 'vitest';
import { createOpenrouterLlmAdapter } from '../src/adapter.js';

describe('createOpenrouterLlmAdapter', () => {
  it('returns frozen adapter with category llm and id llm-openrouter', () => {
    const a = createOpenrouterLlmAdapter({ apiKey: 'sk-or-v1-test' });
    expect(a.category).toBe('llm');
    expect(a.id).toBe('llm-openrouter');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('exposes listModels, generate, stream, getCapabilities methods', () => {
    const a = createOpenrouterLlmAdapter({ apiKey: 'sk-or-v1-test' });
    expect(typeof a.listModels).toBe('function');
    expect(typeof a.generate).toBe('function');
    expect(typeof a.stream).toBe('function');
    expect(typeof a.getCapabilities).toBe('function');
  });

  it('getCapabilities returns the static caps object', () => {
    const a = createOpenrouterLlmAdapter({ apiKey: 'sk-or-v1-test' });
    expect(a.getCapabilities()).toEqual({
      streaming: true,
      tools: false,
      vision: false,
      embeddings: false,
      runtime: true,
    });
  });

  it('rejects mutation (frozen)', () => {
    const a = createOpenrouterLlmAdapter({ apiKey: 'sk-or-v1-test' });
    expect(() => {
      (a as unknown as Record<string, unknown>).id = 'something-else';
    }).toThrow();
  });

  it('throws on invalid config (zod)', () => {
    expect(() => createOpenrouterLlmAdapter({ apiKey: '' })).toThrow();
  });
});
