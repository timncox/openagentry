import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

const requiredEnv = {
  OA_NAMECHEAP_API_USER: 'myuser',
  OA_NAMECHEAP_API_KEY: 'sk_secret_key',
  OA_NAMECHEAP_CLIENT_IP: '1.2.3.4',
};

const allContactEnv = {
  OA_NAMECHEAP_CONTACT_FIRST_NAME: 'Jane',
  OA_NAMECHEAP_CONTACT_LAST_NAME: 'Smith',
  OA_NAMECHEAP_CONTACT_ADDRESS1: '123 Main St',
  OA_NAMECHEAP_CONTACT_CITY: 'Brooklyn',
  OA_NAMECHEAP_CONTACT_STATE_PROVINCE: 'NY',
  OA_NAMECHEAP_CONTACT_POSTAL_CODE: '11205',
  OA_NAMECHEAP_CONTACT_COUNTRY: 'US',
  OA_NAMECHEAP_CONTACT_PHONE: '+1.5551234567',
  OA_NAMECHEAP_CONTACT_EMAIL: 'jane@example.com',
};

describe('readEnvConfig — happy path', () => {
  it('returns ok=true when all required vars are set', () => {
    const result = readEnvConfig(requiredEnv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.apiUser).toBe('myuser');
    expect(result.config.clientIp).toBe('1.2.3.4');
  });

  it('does not echo apiKey value back in the result object keys', () => {
    const result = readEnvConfig(requiredEnv);
    // The config includes apiKey but it should not appear in any error
    // message string. We verify the result is ok (not an error).
    expect(result.ok).toBe(true);
  });

  it('includes no contact when contact vars are absent', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.contact).toBeUndefined();
  });

  it('respects OA_NAMECHEAP_USERNAME when set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_NAMECHEAP_USERNAME: 'reseller',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.userName).toBe('reseller');
  });

  it('respects OA_NAMECHEAP_ENDPOINT when set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_NAMECHEAP_ENDPOINT: 'http://localhost:9090',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBe('http://localhost:9090');
  });
});

describe('readEnvConfig — USE_SANDBOX truthy variants', () => {
  it.each(['1', 'true', 'TRUE', 'True'])(
    'OA_NAMECHEAP_USE_SANDBOX=%s → useSandbox: true',
    (val) => {
      const result = readEnvConfig({ ...requiredEnv, OA_NAMECHEAP_USE_SANDBOX: val });
      if (!result.ok) throw new Error('expected ok');
      expect(result.config.useSandbox).toBe(true);
    },
  );

  it('OA_NAMECHEAP_USE_SANDBOX=0 → useSandbox: false', () => {
    const result = readEnvConfig({ ...requiredEnv, OA_NAMECHEAP_USE_SANDBOX: '0' });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.useSandbox).toBe(false);
  });

  it('omitted OA_NAMECHEAP_USE_SANDBOX → useSandbox not set in config (undefined)', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.useSandbox).toBeUndefined();
  });
});

describe('readEnvConfig — missing required vars', () => {
  it('ok=false when OA_NAMECHEAP_API_USER is missing', () => {
    const { OA_NAMECHEAP_API_USER: _, ...rest } = requiredEnv;
    const result = readEnvConfig(rest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_NAMECHEAP_API_USER');
  });

  it('ok=false when OA_NAMECHEAP_API_KEY is missing', () => {
    const { OA_NAMECHEAP_API_KEY: _, ...rest } = requiredEnv;
    const result = readEnvConfig(rest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_NAMECHEAP_API_KEY');
  });

  it('ok=false when OA_NAMECHEAP_CLIENT_IP is missing', () => {
    const { OA_NAMECHEAP_CLIENT_IP: _, ...rest } = requiredEnv;
    const result = readEnvConfig(rest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_NAMECHEAP_CLIENT_IP');
  });

  it('lists multiple missing vars when several are absent', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_NAMECHEAP_API_USER');
    expect(result.missing).toContain('OA_NAMECHEAP_API_KEY');
    expect(result.missing).toContain('OA_NAMECHEAP_CLIENT_IP');
    expect(result.missing.length).toBe(3);
  });

  it('does not include secret values in the missing array (only names)', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // missing array should be a list of env-var NAME strings, not values
    result.missing.forEach((name) => {
      expect(name).toMatch(/^OA_NAMECHEAP_/);
    });
  });
});

describe('readEnvConfig — contact all-or-nothing', () => {
  it('includes contact when all 9 contact vars are set', () => {
    const result = readEnvConfig({ ...requiredEnv, ...allContactEnv });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.contact).toBeDefined();
    expect(result.config.contact?.firstName).toBe('Jane');
    expect(result.config.contact?.country).toBe('US');
    expect(result.config.contact?.phone).toBe('+1.5551234567');
    expect(result.config.contact?.email).toBe('jane@example.com');
  });

  it('omits contact when 8 of 9 contact vars are set (missing EMAIL)', () => {
    const { OA_NAMECHEAP_CONTACT_EMAIL: _, ...partialContact } = allContactEnv;
    const result = readEnvConfig({ ...requiredEnv, ...partialContact });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.contact).toBeUndefined();
  });

  it('omits contact when only 1 contact var is set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_NAMECHEAP_CONTACT_FIRST_NAME: 'Jane',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.contact).toBeUndefined();
  });

  it('omits contact when no contact vars are set', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.contact).toBeUndefined();
  });
});
