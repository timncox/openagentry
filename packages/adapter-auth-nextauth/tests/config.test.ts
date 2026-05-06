import { describe, it, expect } from 'vitest';
import { parseNextAuthConfig } from '../src/config.js';

const minimalAuthOptions = {
  providers: [{ id: 'credentials', name: 'Credentials' }],
};

describe('parseNextAuthConfig', () => {
  it('accepts a minimal config with secret + authOptions', () => {
    const cfg = parseNextAuthConfig({
      secret: 'sk-test',
      authOptions: minimalAuthOptions,
    });
    expect(cfg.secret).toBe('sk-test');
    expect(cfg.authOptions.providers).toHaveLength(1);
  });

  it('rejects empty secret', () => {
    expect(() =>
      parseNextAuthConfig({ secret: '', authOptions: minimalAuthOptions }),
    ).toThrow(/secret/);
  });

  it('trims whitespace from secret', () => {
    const cfg = parseNextAuthConfig({
      secret: '   sk-test   ',
      authOptions: minimalAuthOptions,
    });
    expect(cfg.secret).toBe('sk-test');
  });

  it('rejects empty providers array', () => {
    expect(() =>
      parseNextAuthConfig({
        secret: 'sk-test',
        authOptions: { providers: [] },
      }),
    ).toThrow(/providers/);
  });

  it('rejects missing authOptions', () => {
    expect(() => parseNextAuthConfig({ secret: 'sk-test' })).toThrow();
  });
});
