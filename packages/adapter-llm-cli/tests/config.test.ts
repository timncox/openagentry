import { describe, expect, it } from 'vitest';
import { llmCliConfigSchema, parseLlmCliConfig } from '../src/config.js';

describe('llmCliConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const parsed = llmCliConfigSchema.parse({ cli: 'claude' });
    expect(parsed.cli).toBe('claude');
    expect(parsed.binPath).toBeUndefined();
    expect(parsed.timeoutMs).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const parsed = llmCliConfigSchema.parse({
      cli: 'codex',
      binPath: '/usr/local/bin/codex',
      timeoutMs: 60_000,
      env: { OPENAI_API_KEY: 'sk-test' },
    });
    expect(parsed.cli).toBe('codex');
    expect(parsed.binPath).toBe('/usr/local/bin/codex');
    expect(parsed.timeoutMs).toBe(60_000);
    expect(parsed.env?.['OPENAI_API_KEY']).toBe('sk-test');
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      llmCliConfigSchema.parse({ cli: 'claude', unknownField: 'x' }),
    ).toThrow();
  });

  it('rejects an unknown cli value', () => {
    expect(() => llmCliConfigSchema.parse({ cli: 'mistral' })).toThrow();
  });

  it('rejects negative timeoutMs', () => {
    expect(() =>
      llmCliConfigSchema.parse({ cli: 'gemini', timeoutMs: -1 }),
    ).toThrow();
  });

  it('rejects timeoutMs of 0', () => {
    expect(() =>
      llmCliConfigSchema.parse({ cli: 'gemini', timeoutMs: 0 }),
    ).toThrow();
  });

  it('parseLlmCliConfig wraps zod errors as AgentryError', () => {
    expect(() => parseLlmCliConfig({ cli: 'mistral' })).toThrow(/SCHEMA/);
  });

  it('parseLlmCliConfig returns the parsed config on success', () => {
    const cfg = parseLlmCliConfig({ cli: 'gemini', timeoutMs: 30_000 });
    expect(cfg.cli).toBe('gemini');
    expect(cfg.timeoutMs).toBe(30_000);
  });
});
