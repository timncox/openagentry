import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

const ENV_KEYS = [
  'OA_AIGATEWAY_API_KEY',
  'OA_AIGATEWAY_DEFAULT_MODEL',
  'OA_AIGATEWAY_BASE_URL',
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
  it('exports the named factory + types + codes', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.createAigatewayLlmAdapter).toBe('function');
    expect(typeof mod.parseAigatewayLlmConfig).toBe('function');
    expect(mod.ADAPTER_ID).toBe('llm-aigateway');
    expect(mod.AIGATEWAY_ERROR_CODES).toBeDefined();
  });
});

describe('lazy default export', () => {
  it('does not throw at import time when env is missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    expect(lazy.category).toBe('llm');
    expect(lazy.id).toBe('llm-aigateway');
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

  it('throws E_AIGATEWAY_CONFIG_INVALID on first generate() when apiKey missing', async () => {
    clearEnv();
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.generate('p')).rejects.toMatchObject({
      code: 'E_AIGATEWAY_CONFIG_INVALID',
      phase: 'init',
    });
  });

  it('throws E_AIGATEWAY_CONFIG_INVALID on listModels() when env is invalid', async () => {
    clearEnv();
    process.env.OA_AIGATEWAY_API_KEY = 'k';
    process.env.OA_AIGATEWAY_BASE_URL = 'not a url';
    vi.resetModules();
    const { default: lazy } = await import('../src/index.js');
    await expect(lazy.listModels()).rejects.toMatchObject({
      code: 'E_AIGATEWAY_CONFIG_INVALID',
      phase: 'init',
    });
  });
});
