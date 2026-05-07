import { describe, it, expect } from 'vitest';
import {
  parseNamecheapDomainConfig,
  namecheapDomainConfigSchema,
  namecheapContactSchema,
} from '../src/config.js';

const minimalValid = {
  apiUser: 'myuser',
  apiKey: 'sk_abc123',
  clientIp: '1.2.3.4',
};

const fullContact = {
  firstName: 'Jane',
  lastName: 'Smith',
  address1: '123 Main St',
  city: 'Brooklyn',
  stateProvince: 'NY',
  postalCode: '11205',
  country: 'US',
  phone: '+1.5551234567',
  email: 'jane@example.com',
};

describe('parseNamecheapDomainConfig — valid inputs', () => {
  it('accepts minimal config and fills defaults', () => {
    const cfg = parseNamecheapDomainConfig(minimalValid);
    expect(cfg.apiUser).toBe('myuser');
    expect(cfg.apiKey).toBe('sk_abc123');
    expect(cfg.clientIp).toBe('1.2.3.4');
    expect(cfg.useSandbox).toBe(false);
    expect(cfg.endpoint).toBe('https://api.namecheap.com/xml.response');
  });

  it('defaults userName to apiUser when not provided', () => {
    const cfg = parseNamecheapDomainConfig(minimalValid);
    expect(cfg.userName).toBe('myuser');
  });

  it('respects explicit userName when provided', () => {
    const cfg = parseNamecheapDomainConfig({ ...minimalValid, userName: 'reseller' });
    expect(cfg.userName).toBe('reseller');
  });

  it('useSandbox: true sets sandbox endpoint', () => {
    const cfg = parseNamecheapDomainConfig({ ...minimalValid, useSandbox: true });
    expect(cfg.endpoint).toBe('https://api.sandbox.namecheap.com/xml.response');
  });

  it('explicit endpoint overrides useSandbox: true', () => {
    const cfg = parseNamecheapDomainConfig({
      ...minimalValid,
      useSandbox: true,
      endpoint: 'http://localhost:9090',
    });
    expect(cfg.endpoint).toBe('http://localhost:9090');
  });

  it('explicit endpoint with useSandbox: false overrides default', () => {
    const cfg = parseNamecheapDomainConfig({
      ...minimalValid,
      endpoint: 'http://localhost:8080',
    });
    expect(cfg.endpoint).toBe('http://localhost:8080');
  });

  it('accepts a full contact block', () => {
    const cfg = parseNamecheapDomainConfig({ ...minimalValid, contact: fullContact });
    expect(cfg.contact).toBeDefined();
    expect(cfg.contact?.firstName).toBe('Jane');
    expect(cfg.contact?.country).toBe('US');
    expect(cfg.contact?.phone).toBe('+1.5551234567');
    expect(cfg.contact?.email).toBe('jane@example.com');
  });

  it('contact is optional — no contact = cfg.contact undefined', () => {
    const cfg = parseNamecheapDomainConfig(minimalValid);
    expect(cfg.contact).toBeUndefined();
  });

  it('trims whitespace from string fields', () => {
    const cfg = parseNamecheapDomainConfig({
      apiUser: '  myuser  ',
      apiKey: '  sk_abc  ',
      clientIp: '  1.2.3.4  ',
    });
    expect(cfg.apiUser).toBe('myuser');
    expect(cfg.apiKey).toBe('sk_abc');
    expect(cfg.clientIp).toBe('1.2.3.4');
  });
});

describe('parseNamecheapDomainConfig — invalid inputs', () => {
  it('rejects missing apiUser — throws AgentryError with E_NAMECHEAP_SCHEMA', () => {
    expect(() =>
      parseNamecheapDomainConfig({ apiKey: 'sk_abc', clientIp: '1.2.3.4' }),
    ).toThrow(
      expect.objectContaining({ code: 'E_NAMECHEAP_SCHEMA', phase: 'init' }),
    );
  });

  it('rejects missing apiKey — E_NAMECHEAP_SCHEMA', () => {
    expect(() =>
      parseNamecheapDomainConfig({ apiUser: 'u', clientIp: '1.2.3.4' }),
    ).toThrow(expect.objectContaining({ code: 'E_NAMECHEAP_SCHEMA' }));
  });

  it('rejects missing clientIp — E_NAMECHEAP_SCHEMA', () => {
    expect(() =>
      parseNamecheapDomainConfig({ apiUser: 'u', apiKey: 'k' }),
    ).toThrow(expect.objectContaining({ code: 'E_NAMECHEAP_SCHEMA' }));
  });

  it('includes zodIssues in context', () => {
    try {
      parseNamecheapDomainConfig({});
    } catch (err) {
      expect((err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues).toBeDefined();
      expect(
        Array.isArray((err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues),
      ).toBe(true);
    }
  });

  it('rejects extra keys (.strict() mode)', () => {
    expect(() =>
      parseNamecheapDomainConfig({ ...minimalValid, sneaky: 'extra' }),
    ).toThrow(expect.objectContaining({ code: 'E_NAMECHEAP_SCHEMA' }));
  });

  it('rejects non-URL endpoint', () => {
    expect(() =>
      parseNamecheapDomainConfig({ ...minimalValid, endpoint: 'not-a-url' }),
    ).toThrow(expect.objectContaining({ code: 'E_NAMECHEAP_SCHEMA' }));
  });
});

describe('namecheapContactSchema — validation', () => {
  it('accepts a valid contact object', () => {
    const result = namecheapContactSchema.safeParse(fullContact);
    expect(result.success).toBe(true);
  });

  it('rejects country with more than 2 chars', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, country: 'USA' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('country'))).toBe(true);
    }
  });

  it('rejects country with 1 char', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, country: 'U' });
    expect(result.success).toBe(false);
  });

  it('rejects phone without + prefix', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, phone: '15551234567' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('phone'))).toBe(true);
    }
  });

  it('rejects phone without dot separator', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, phone: '+15551234567' });
    expect(result.success).toBe(false);
  });

  it('accepts phone with multi-digit country code', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, phone: '+44.7700900123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('email'))).toBe(true);
    }
  });

  it('rejects missing required contact field', () => {
    const { firstName: _, ...withoutFirst } = fullContact;
    const result = namecheapContactSchema.safeParse(withoutFirst);
    expect(result.success).toBe(false);
  });

  it('rejects extra keys in contact (.strict())', () => {
    const result = namecheapContactSchema.safeParse({ ...fullContact, extra: 'field' });
    expect(result.success).toBe(false);
  });
});

describe('namecheapDomainConfigSchema', () => {
  it('schema is exported for advanced consumers', () => {
    const result = namecheapDomainConfigSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });
});
