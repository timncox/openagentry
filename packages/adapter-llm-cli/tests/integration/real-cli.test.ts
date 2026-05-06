import { describe, expect, it } from 'vitest';
import { createLlmCliAdapter } from '../../src/adapter.js';

const target = process.env['OA_TEST_LLM_CLI'] as
  | 'claude'
  | 'codex'
  | 'gemini'
  | undefined;

const isValidTarget =
  target === 'claude' || target === 'codex' || target === 'gemini';

describe.skipIf(!isValidTarget)('integration: real-CLI smoke test', () => {
  it(
    `lists models, generates text, and streams against installed ${target}`,
    async () => {
      if (!isValidTarget) return;
      const adapter = createLlmCliAdapter({ cli: target });

      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(1);

      const r = await adapter.generate('Reply with the word OK.');
      expect(r.text.toUpperCase()).toContain('OK');

      let chunkCount = 0;
      let doneCount = 0;
      for await (const chunk of adapter.stream('Count from 1 to 3.')) {
        if (chunk.type === 'text') chunkCount++;
        if (chunk.type === 'done') doneCount++;
      }
      expect(chunkCount).toBeGreaterThanOrEqual(1);
      expect(doneCount).toBe(1);
    },
    120_000,
  );
});
