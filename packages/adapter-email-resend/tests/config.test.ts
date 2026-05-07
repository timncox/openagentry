import { describe, it, expect } from 'vitest';
import {
  parseResendEmailConfig,
  resendEmailConfigSchema,
} from '../src/config.js';

describe('parseResendEmailConfig — valid inputs', () => {
  it('accepts a minimal config and applies endpoint default', () => {
    const cfg = parseResendEmailConfig({ apiKey: 're_abc123' });
    expect(cfg.apiKey).toBe('re_abc123');
    expect(cfg.endpoint).toBe('https://api.resend.com');
  });

  it('accepts an explicit endpoint override', () => {
    const cfg = parseResendEmailConfig({
      apiKey: 're_abc123',
      endpoint: 'http://localhost:8080',
    });
    expect(cfg.endpoint).toBe('http://localhost:8080');
  });

  it('trims surrounding whitespace from apiKey', () => {
    const cfg = parseResendEmailConfig({ apiKey: '  re_abc123  ' });
    expect(cfg.apiKey).toBe('re_abc123');
  });
});

describe('parseResendEmailConfig — invalid inputs', () => {
  it('rejects missing apiKey', () => {
    expect(() => parseResendEmailConfig({})).toThrow();
  });

  it('rejects empty-string apiKey', () => {
    expect(() => parseResendEmailConfig({ apiKey: '' })).toThrow(/non-empty/);
  });

  it('rejects whitespace-only apiKey (after trim)', () => {
    expect(() => parseResendEmailConfig({ apiKey: '   ' })).toThrow(/non-empty/);
  });

  it('rejects non-string apiKey', () => {
    expect(() => parseResendEmailConfig({ apiKey: 42 })).toThrow();
  });

  it('rejects non-URL endpoint', () => {
    expect(() => parseResendEmailConfig({ apiKey: 're_x', endpoint: 'not a url' })).toThrow();
  });

  it('rejects extra keys (.strict() mode)', () => {
    expect(() => parseResendEmailConfig({ apiKey: 're_x', sneaky: 'extra' })).toThrow();
  });
});

describe('resendEmailConfigSchema', () => {
  it('schema is exposed for advanced consumers', () => {
    const result = resendEmailConfigSchema.safeParse({ apiKey: 're_x' });
    expect(result.success).toBe(true);
  });
});
