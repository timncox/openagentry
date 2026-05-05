import { describe, it, expect } from 'vitest';
import { parseNeonConfig } from '../src/config.js';

describe('parseNeonConfig', () => {
  it('accepts a minimal config with apiKey only', () => {
    const cfg = parseNeonConfig({ apiKey: 'neon_xxx_secret' });
    expect(cfg.apiKey).toBe('neon_xxx_secret');
    expect(cfg.apiBase).toBe('https://console.neon.tech/api/v2');
    expect(cfg.defaultRegion).toBe('aws-us-east-2');
  });

  it('rejects empty apiKey', () => {
    expect(() => parseNeonConfig({ apiKey: '' })).toThrow();
  });

  it('trims whitespace from apiKey', () => {
    const cfg = parseNeonConfig({ apiKey: '  neon_x  ' });
    expect(cfg.apiKey).toBe('neon_x');
  });

  it('rejects malformed apiBase URL', () => {
    expect(() => parseNeonConfig({ apiKey: 'k', apiBase: 'not-a-url' })).toThrow();
  });

  it('accepts custom defaultRegion', () => {
    const cfg = parseNeonConfig({ apiKey: 'k', defaultRegion: 'aws-us-west-2' });
    expect(cfg.defaultRegion).toBe('aws-us-west-2');
  });

  it('rejects unknown keys', () => {
    expect(() => parseNeonConfig({ apiKey: 'k', unexpectedField: 'oops' })).toThrow();
  });

  it('rejects whitespace-only apiKey', () => {
    expect(() => parseNeonConfig({ apiKey: '   ' })).toThrow();
  });
});
