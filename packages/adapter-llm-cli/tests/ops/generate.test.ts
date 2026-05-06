import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAgentryError } from '@openagentry/core';
import { generate } from '../../src/ops/generate.js';
import { claudeDispatch } from '../../src/dispatch/claude.js';
import { defaultSpawn } from '../../src/exec.js';

const here = dirname(fileURLToPath(import.meta.url));
const stubClaude = resolve(here, '../fixtures/stub-claude.js');

const ctx = {
  dispatch: claudeDispatch,
  config: { cli: 'claude' as const, binPath: stubClaude },
  spawn: defaultSpawn,
};

describe('generate', () => {
  it('returns text + model on Say hi.', async () => {
    const r = await generate(ctx, 'Say hi.');
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.model).toMatch(/^claude-/);
    expect(r.text).toContain('hi from stub-claude');
  });

  it('forwards system opt to the stub', async () => {
    const r = await generate(ctx, 'Echo system.', { system: 'sys-marker-42' });
    expect(r.text).toContain('sys-marker-42');
  });

  it('throws AgentryError on error:nonzero prompt', async () => {
    try {
      await generate(ctx, 'error:nonzero');
      throw new Error('expected throw');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_LLM_CLI_NONZERO');
    }
  });

  it('parses usage from final result block', async () => {
    const r = await generate(ctx, 'Count to three.');
    expect(r.usage).toBeDefined();
    expect(r.usage?.inputTokens).toBeGreaterThan(0);
  });
});
