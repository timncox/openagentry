import { describe, it, expect } from 'vitest';
import { createAigatewayLlmAdapter } from '../src/index.js';

const TOKEN = process.env.OA_AIGATEWAY_API_KEY;
const MODEL = process.env.OA_AIGATEWAY_DEFAULT_MODEL;
const HAS_REAL_TOKEN =
  typeof TOKEN === 'string' &&
  TOKEN.length > 0 &&
  !TOKEN.startsWith('vck_DUMMY_') &&
  TOKEN !== 'vck_TEST' &&
  typeof MODEL === 'string' &&
  MODEL.length > 0;

describe.skipIf(!HAS_REAL_TOKEN)('integration: real Vercel AI Gateway', () => {
  it('lists models, generates text, and streams', async () => {
    const adapter = createAigatewayLlmAdapter({
      apiKey: TOKEN!,
      defaultModel: MODEL!,
    });

    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.find((m) => m.id === MODEL)).toBeDefined();

    const gen = await adapter.generate('Say "hi" and nothing else.', { maxTokens: 20 });
    expect(typeof gen.text).toBe('string');
    expect(gen.text.length).toBeGreaterThan(0);
    expect(gen.model).toBe(MODEL);

    let textChunks = 0;
    let dones = 0;
    for await (const chunk of adapter.stream('Count to three.', { maxTokens: 50 })) {
      if (chunk.type === 'text') textChunks++;
      else if (chunk.type === 'done') dones++;
    }
    expect(textChunks).toBeGreaterThan(0);
    expect(dones).toBe(1);
  }, 60_000);
});
