import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAgentryError } from '@openagentry/core';
import { init, refresh, healthcheck } from '../src/lifecycle.js';
import { claudeDispatch } from '../src/dispatch/claude.js';
import { defaultSpawn } from '../src/exec.js';

const here = dirname(fileURLToPath(import.meta.url));
const stubClaude = resolve(here, 'fixtures/stub-claude.js');

const ctx = {
  dispatch: claudeDispatch,
  config: { cli: 'claude' as const, binPath: stubClaude },
  spawn: defaultSpawn,
};

describe('lifecycle', () => {
  it('init resolves binary without throwing', async () => {
    await expect(init(ctx)).resolves.not.toThrow();
  });

  it('init throws E_LLM_CLI_NOT_FOUND for missing binPath', async () => {
    try {
      await init({
        dispatch: claudeDispatch,
        config: { cli: 'claude', binPath: '/nonexistent/path' },
        spawn: defaultSpawn,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_LLM_CLI_NOT_FOUND');
    }
  });

  it('refresh is a no-op', async () => {
    await expect(refresh(ctx)).resolves.toBeUndefined();
  });

  it('healthcheck runs the stub binary (which exits 0 on --version)', async () => {
    // The stub-claude.js script doesn't recognize --version explicitly but
    // exits 0 with default response, satisfying the healthcheck contract.
    await expect(healthcheck(ctx)).resolves.not.toThrow();
  });
});
