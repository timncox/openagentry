import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmCliAdapter } from '../src/adapter.js';

const here = dirname(fileURLToPath(import.meta.url));
const stubClaude = resolve(here, 'fixtures/stub-claude.js');

describe('createLlmCliAdapter', () => {
  it('returns a frozen LlmAdapter with category llm + id llm-cli', () => {
    const a = createLlmCliAdapter({ cli: 'claude', binPath: stubClaude });
    expect(a.category).toBe('llm');
    expect(a.id).toBe('llm-cli');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('listModels returns models from claude dispatch', async () => {
    const a = createLlmCliAdapter({ cli: 'claude', binPath: stubClaude });
    const models = await a.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    const first = models[0];
    expect(first).toBeDefined();
    expect(first!.id).toMatch(/^claude-/);
  });

  it('generate returns text', async () => {
    const a = createLlmCliAdapter({ cli: 'claude', binPath: stubClaude });
    const r = await a.generate('Say hi.');
    expect(r.text).toContain('hi from stub-claude');
  });

  it('stream yields chunks then done', async () => {
    const a = createLlmCliAdapter({ cli: 'claude', binPath: stubClaude });
    const types: string[] = [];
    for await (const chunk of a.stream('Count to three.')) {
      types.push(chunk.type);
    }
    expect(types.filter((t) => t === 'text').length).toBeGreaterThanOrEqual(3);
    expect(types.filter((t) => t === 'done').length).toBe(1);
  });

  it('throws on bad config (zod failure)', () => {
    expect(() => createLlmCliAdapter({ cli: 'mistral' })).toThrow();
  });
});
