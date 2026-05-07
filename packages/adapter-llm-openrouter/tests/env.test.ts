import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

describe('env — readEnvConfig', () => {
  it('returns ok with minimal env', () => {
    const r = readEnvConfig({ OA_OPENROUTER_API_KEY: 'sk-or-v1-test' });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.config.apiKey).toBe('sk-or-v1-test');
    expect(r.config.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(r.config.defaultModel).toBeUndefined();
    expect(r.config.appUrl).toBeUndefined();
    expect(r.config.appTitle).toBeUndefined();
  });

  it('returns missing when OA_OPENROUTER_API_KEY unset', () => {
    const r = readEnvConfig({});
    expect(r.kind).toBe('missing');
    if (r.kind !== 'missing') return;
    expect(r.missing).toEqual(['OA_OPENROUTER_API_KEY']);
  });

  it('returns missing when OA_OPENROUTER_API_KEY is empty string', () => {
    const r = readEnvConfig({ OA_OPENROUTER_API_KEY: '' });
    expect(r.kind).toBe('missing');
  });

  it('passes optional fields through when set', () => {
    const r = readEnvConfig({
      OA_OPENROUTER_API_KEY: 'sk-or-v1-test',
      OA_OPENROUTER_DEFAULT_MODEL: 'openai/gpt-5.2',
      OA_OPENROUTER_BASE_URL: 'https://example.com/v1',
      OA_OPENROUTER_APP_URL: 'https://my-app.example.com',
      OA_OPENROUTER_APP_TITLE: 'My App',
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.config.defaultModel).toBe('openai/gpt-5.2');
    expect(r.config.baseUrl).toBe('https://example.com/v1');
    expect(r.config.appUrl).toBe('https://my-app.example.com');
    expect(r.config.appTitle).toBe('My App');
  });

  it('skips empty optional fields', () => {
    const r = readEnvConfig({
      OA_OPENROUTER_API_KEY: 'sk-or-v1-test',
      OA_OPENROUTER_DEFAULT_MODEL: '',
      OA_OPENROUTER_BASE_URL: '',
      OA_OPENROUTER_APP_URL: '',
      OA_OPENROUTER_APP_TITLE: '',
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.config.defaultModel).toBeUndefined();
    expect(r.config.appUrl).toBeUndefined();
    expect(r.config.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('returns invalid for malformed baseUrl', () => {
    const r = readEnvConfig({
      OA_OPENROUTER_API_KEY: 'sk-or-v1-test',
      OA_OPENROUTER_BASE_URL: 'not-a-url',
    });
    expect(r.kind).toBe('invalid');
  });

  it('returns invalid for malformed appUrl', () => {
    const r = readEnvConfig({
      OA_OPENROUTER_API_KEY: 'sk-or-v1-test',
      OA_OPENROUTER_APP_URL: 'not-a-url',
    });
    expect(r.kind).toBe('invalid');
  });
});
