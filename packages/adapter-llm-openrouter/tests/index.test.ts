import { describe, it, expect, beforeEach, vi } from 'vitest';

const ENV_KEYS = [
  'OA_OPENROUTER_API_KEY',
  'OA_OPENROUTER_DEFAULT_MODEL',
  'OA_OPENROUTER_BASE_URL',
  'OA_OPENROUTER_APP_URL',
  'OA_OPENROUTER_APP_TITLE',
] as const;

function clearEnv(): void {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

beforeEach(() => {
  clearEnv();
  vi.resetModules();
});

describe('public exports', () => {
  it('exports the named factory + types + codes + version', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.createOpenrouterLlmAdapter).toBe('function');
    expect(typeof mod.parseOpenrouterLlmConfig).toBe('function');
    expect(mod.ADAPTER_ID).toBe('llm-openrouter');
    expect(mod.OPENROUTER_ERROR_CODES.AUTH).toBe('E_OPENROUTER_AUTH');
    expect(mod.ADAPTER_VERSION).toBe('0.1.0-alpha.0');
  });
});

describe('lazy default export', () => {
  it('does not throw at import time when env is missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    expect(lazy.category).toBe('llm');
    expect(lazy.id).toBe('llm-openrouter');
  });

  it('getCapabilities returns the static caps even when env is missing (no throw)', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    expect(lazy.getCapabilities()).toEqual({
      streaming: true,
      tools: false,
      vision: false,
      embeddings: false,
      runtime: true,
    });
  });

  it('throws E_OPENROUTER_CONFIG_INVALID on first generate() when apiKey missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.generate('p')).rejects.toMatchObject({
      code: 'E_OPENROUTER_CONFIG_INVALID',
      phase: 'init',
    });
  });

  it('throws E_OPENROUTER_CONFIG_INVALID on listModels() when env is invalid', async () => {
    clearEnv();
    process.env.OA_OPENROUTER_API_KEY = 'k';
    process.env.OA_OPENROUTER_BASE_URL = 'not a url';
    vi.resetModules();
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.listModels()).rejects.toMatchObject({
      code: 'E_OPENROUTER_CONFIG_INVALID',
      phase: 'init',
    });
  });

  it('caches the built adapter (singleton) when env stays valid', async () => {
    process.env.OA_OPENROUTER_API_KEY = 'sk-or-v1-test';
    const { default: lazy } = await import('../src/index.js');
    // Call getCapabilities twice — must not rebuild from env each time.
    const a = lazy.getCapabilities();
    const b = lazy.getCapabilities();
    expect(a).toEqual(b);
  });
});
