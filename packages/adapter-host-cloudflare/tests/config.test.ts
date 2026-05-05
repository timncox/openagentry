import { describe, it, expect } from 'vitest';
import { cloudflareConfigSchema, parseCloudflareConfig } from '../src/config.js';

describe('cloudflareConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const cfg = parseCloudflareConfig({
      apiToken: 'cf-token',
      accountId: '0123456789abcdef0123456789abcdef',
    });
    expect(cfg.apiToken).toBe('cf-token');
    expect(cfg.accountId).toBe('0123456789abcdef0123456789abcdef');
    expect(cfg.apiBase).toBe('https://api.cloudflare.com/client/v4');
  });

  it('overrides apiBase when provided', () => {
    const cfg = parseCloudflareConfig({
      apiToken: 't',
      accountId: '0123456789abcdef0123456789abcdef',
      apiBase: 'https://example.test/v4',
    });
    expect(cfg.apiBase).toBe('https://example.test/v4');
  });

  it('rejects empty apiToken', () => {
    expect(() =>
      parseCloudflareConfig({ apiToken: '', accountId: '0123456789abcdef0123456789abcdef' }),
    ).toThrow(/apiToken/);
  });

  it('rejects malformed accountId', () => {
    expect(() => parseCloudflareConfig({ apiToken: 't', accountId: 'not-hex' })).toThrow(/accountId/);
  });

  it('schema parse and parser produce identical objects', () => {
    const input = { apiToken: 't', accountId: '0123456789abcdef0123456789abcdef' };
    expect(cloudflareConfigSchema.parse(input)).toEqual(parseCloudflareConfig(input));
  });

  it('rejects whitespace-only apiToken', () => {
    expect(() =>
      parseCloudflareConfig({
        apiToken: '   ',
        accountId: '0123456789abcdef0123456789abcdef',
      }),
    ).toThrow(/apiToken/);
  });

  it('rejects non-URL apiBase', () => {
    expect(() =>
      parseCloudflareConfig({
        apiToken: 't',
        accountId: '0123456789abcdef0123456789abcdef',
        apiBase: 'not-a-url',
      }),
    ).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      parseCloudflareConfig({
        apiToken: 't',
        accountId: '0123456789abcdef0123456789abcdef',
        unexpectedField: 'oops',
      }),
    ).toThrow();
  });
});
