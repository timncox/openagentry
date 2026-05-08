import { describe, it, expect } from 'vitest';
import {
  parseOpenrouterLlmConfig,
  openrouterLlmConfigSchema,
  type OpenrouterLlmConfig,
} from '../src/config.js';

describe('config — openrouterLlmConfigSchema', () => {
  it('accepts minimal valid config and applies defaults', () => {
    const cfg: OpenrouterLlmConfig = parseOpenrouterLlmConfig({ apiKey: 'sk-or-v1-test' });
    expect(cfg.apiKey).toBe('sk-or-v1-test');
    expect(cfg.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(cfg.defaultModel).toBeUndefined();
    expect(cfg.appUrl).toBeUndefined();
    expect(cfg.appTitle).toBeUndefined();
  });

  it('trims whitespace from apiKey', () => {
    const cfg = parseOpenrouterLlmConfig({ apiKey: '  sk-or-v1-test  ' });
    expect(cfg.apiKey).toBe('sk-or-v1-test');
  });

  it('rejects empty apiKey', () => {
    expect(() => parseOpenrouterLlmConfig({ apiKey: '' })).toThrow(/apiKey/);
    expect(() => parseOpenrouterLlmConfig({ apiKey: '   ' })).toThrow(/apiKey/);
  });

  it('rejects extra keys (.strict mode)', () => {
    expect(() =>
      parseOpenrouterLlmConfig({ apiKey: 'sk-or-v1-test', extraField: 'nope' } as unknown),
    ).toThrow();
  });

  it('rejects invalid baseUrl', () => {
    expect(() =>
      parseOpenrouterLlmConfig({ apiKey: 'sk-or-v1-test', baseUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects invalid appUrl', () => {
    expect(() =>
      parseOpenrouterLlmConfig({ apiKey: 'sk-or-v1-test', appUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('accepts valid full config', () => {
    const cfg = parseOpenrouterLlmConfig({
      apiKey: 'sk-or-v1-test',
      defaultModel: 'openai/gpt-5.2',
      baseUrl: 'https://openrouter.ai/api/v1',
      appUrl: 'https://my-app.example.com',
      appTitle: 'My App',
    });
    expect(cfg.defaultModel).toBe('openai/gpt-5.2');
    expect(cfg.appUrl).toBe('https://my-app.example.com');
    expect(cfg.appTitle).toBe('My App');
  });

  it('exports schema for direct use', () => {
    expect(openrouterLlmConfigSchema).toBeDefined();
    const r = openrouterLlmConfigSchema.safeParse({ apiKey: 'k' });
    expect(r.success).toBe(true);
  });
});
