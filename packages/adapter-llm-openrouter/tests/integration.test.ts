import { describe, it, expect } from 'vitest';
import { createOpenrouterLlmAdapter } from '../src/index.js';

const TOKEN = process.env.OA_OPENROUTER_API_KEY;
const HAS_REAL_TOKEN =
  typeof TOKEN === 'string' &&
  TOKEN.length > 0 &&
  !TOKEN.startsWith('sk-or-v1-test') &&
  !TOKEN.includes('DUMMY') &&
  TOKEN !== 'sk-or-v1-test-conformance';

describe.skipIf(!HAS_REAL_TOKEN)('integration: real OpenRouter API', () => {
  it('lists models, generates text, and streams', async () => {
    const adapter = createOpenrouterLlmAdapter({
      apiKey: TOKEN!,
      defaultModel: 'openrouter/auto',
    });

    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);

    const gen = await adapter.generate('Reply with the single word: OK', {
      model: 'openrouter/auto',
      maxTokens: 20,
    });
    expect(typeof gen.text).toBe('string');
    expect(gen.text.length).toBeGreaterThan(0);

    let textChunks = 0;
    let dones = 0;
    for await (const chunk of adapter.stream('Count to three.', {
      model: 'openrouter/auto',
      maxTokens: 50,
    })) {
      if (chunk.type === 'text') textChunks++;
      else if (chunk.type === 'done') dones++;
    }
    expect(textChunks).toBeGreaterThan(0);
    expect(dones).toBe(1);
  }, 60_000);
});
