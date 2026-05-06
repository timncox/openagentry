import { describe, expect, it } from 'vitest';
import { listModels } from '../../src/ops/list-models.js';
import { claudeDispatch } from '../../src/dispatch/claude.js';

describe('listModels', () => {
  it('returns the dispatch.models() array', () => {
    const models = listModels(claudeDispatch);
    expect(models.length).toBeGreaterThanOrEqual(3);
    const first = models[0];
    expect(first).toBeDefined();
    expect(first!.id).toMatch(/^claude-/);
  });
});
