import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

describe('readEnvConfig', () => {
  it('returns ok for the minimal env (apiKey only)', () => {
    const r = readEnvConfig({ OA_AIGATEWAY_API_KEY: 'k' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.apiKey).toBe('k');
      expect(r.config.baseUrl).toBe('https://ai-gateway.vercel.sh/v1');
      expect(r.config.defaultModel).toBeUndefined();
    }
  });

  it('reports missing apiKey via {kind: missing}', () => {
    expect(readEnvConfig({})).toEqual({ kind: 'missing', missing: ['OA_AIGATEWAY_API_KEY'] });
  });

  it('reports an empty-string apiKey as missing', () => {
    expect(readEnvConfig({ OA_AIGATEWAY_API_KEY: '' })).toEqual({
      kind: 'missing',
      missing: ['OA_AIGATEWAY_API_KEY'],
    });
  });

  it('honors OA_AIGATEWAY_DEFAULT_MODEL', () => {
    const r = readEnvConfig({
      OA_AIGATEWAY_API_KEY: 'k',
      OA_AIGATEWAY_DEFAULT_MODEL: 'anthropic/claude-opus-4.6',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.defaultModel).toBe('anthropic/claude-opus-4.6');
    }
  });

  it('honors OA_AIGATEWAY_BASE_URL', () => {
    const r = readEnvConfig({
      OA_AIGATEWAY_API_KEY: 'k',
      OA_AIGATEWAY_BASE_URL: 'https://custom.example.com/v1',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.baseUrl).toBe('https://custom.example.com/v1');
    }
  });

  it('returns {kind: invalid} on bad baseUrl', () => {
    const r = readEnvConfig({ OA_AIGATEWAY_API_KEY: 'k', OA_AIGATEWAY_BASE_URL: 'not a url' });
    expect(r.kind).toBe('invalid');
  });

  it('treats empty optional-env strings as unset (uses defaults)', () => {
    const r = readEnvConfig({
      OA_AIGATEWAY_API_KEY: 'k',
      OA_AIGATEWAY_DEFAULT_MODEL: '',
      OA_AIGATEWAY_BASE_URL: '',
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.config.defaultModel).toBeUndefined();
      expect(r.config.baseUrl).toBe('https://ai-gateway.vercel.sh/v1');
    }
  });
});
