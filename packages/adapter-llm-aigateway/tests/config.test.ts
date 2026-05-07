import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { parseAigatewayLlmConfig, aigatewayLlmConfigSchema } from '../src/config.js';

describe('aigatewayLlmConfigSchema', () => {
  it('accepts a minimal config (apiKey only) and applies baseUrl default', () => {
    const cfg = parseAigatewayLlmConfig({ apiKey: 'vck_TOKEN' });
    expect(cfg.apiKey).toBe('vck_TOKEN');
    expect(cfg.baseUrl).toBe('https://ai-gateway.vercel.sh/v1');
    expect(cfg.defaultModel).toBeUndefined();
  });

  it('preserves explicit overrides', () => {
    const cfg = parseAigatewayLlmConfig({
      apiKey: 'vck_TOKEN',
      defaultModel: 'anthropic/claude-opus-4.6',
      baseUrl: 'https://custom.example.com/v1',
    });
    expect(cfg.defaultModel).toBe('anthropic/claude-opus-4.6');
    expect(cfg.baseUrl).toBe('https://custom.example.com/v1');
  });

  it('trims surrounding whitespace from apiKey', () => {
    const cfg = parseAigatewayLlmConfig({ apiKey: '  vck_K  ' });
    expect(cfg.apiKey).toBe('vck_K');
  });

  it('trims defaultModel when provided', () => {
    const cfg = parseAigatewayLlmConfig({ apiKey: 'k', defaultModel: '  anthropic/claude-opus-4.6  ' });
    expect(cfg.defaultModel).toBe('anthropic/claude-opus-4.6');
  });
});

describe('aigatewayLlmConfigSchema validation failures', () => {
  it('rejects a missing apiKey', () => {
    expect(() => parseAigatewayLlmConfig({})).toThrow(ZodError);
  });

  it('rejects an empty-after-trim apiKey', () => {
    expect(() => parseAigatewayLlmConfig({ apiKey: '   ' })).toThrow(ZodError);
  });

  it('rejects an empty-after-trim defaultModel', () => {
    expect(() => parseAigatewayLlmConfig({ apiKey: 'k', defaultModel: '   ' })).toThrow(ZodError);
  });

  it('rejects a non-URL baseUrl', () => {
    expect(() => parseAigatewayLlmConfig({ apiKey: 'k', baseUrl: 'not a url' })).toThrow(ZodError);
  });

  it('rejects unknown keys (.strict)', () => {
    expect(() => parseAigatewayLlmConfig({ apiKey: 'k', unknownKey: 'x' })).toThrow(ZodError);
  });
});
