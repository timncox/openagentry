import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

describe('readEnvConfig — happy path', () => {
  it('returns ok with parsed config when required env is set', () => {
    const result = readEnvConfig({ OA_RESEND_API_KEY: 're_abc' });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.config.apiKey).toBe('re_abc');
    expect(result.config.endpoint).toBe('https://api.resend.com');
  });

  it('passes endpoint through when set', () => {
    const result = readEnvConfig({
      OA_RESEND_API_KEY: 're_abc',
      OA_RESEND_ENDPOINT: 'http://localhost:8080',
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.config.endpoint).toBe('http://localhost:8080');
  });
});

describe('readEnvConfig — missing required vars', () => {
  it('reports missing OA_RESEND_API_KEY', () => {
    const result = readEnvConfig({});
    expect(result.kind).toBe('missing');
    if (result.kind !== 'missing') return;
    expect(result.missing).toEqual(['OA_RESEND_API_KEY']);
  });

  it('treats empty-string as missing', () => {
    const result = readEnvConfig({ OA_RESEND_API_KEY: '' });
    expect(result.kind).toBe('missing');
  });
});

describe('readEnvConfig — invalid values', () => {
  it('reports invalid when endpoint is malformed', () => {
    const result = readEnvConfig({
      OA_RESEND_API_KEY: 're_abc',
      OA_RESEND_ENDPOINT: 'not-a-url',
    });
    expect(result.kind).toBe('invalid');
  });

  it('treats empty-string endpoint as unset (not invalid)', () => {
    const result = readEnvConfig({
      OA_RESEND_API_KEY: 're_abc',
      OA_RESEND_ENDPOINT: '',
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.config.endpoint).toBe('https://api.resend.com');
  });
});
