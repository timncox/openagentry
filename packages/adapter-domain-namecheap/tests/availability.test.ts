import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { checkAvailability } from '../src/availability.js';
import type { NamecheapDomainConfig } from '../src/config.js';
import { NAMECHEAP_ERROR_CODES } from '../src/errors.js';

const cfg: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey',
  clientIp: '1.2.3.4',
  userName: 'testuser',
  endpoint: 'http://localhost:9100/xml.response',
  useSandbox: false,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function availableXml(domain: string, available: 'true' | 'false'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="${domain}" Available="${available}" ErrorNo="0"
      Description="" IsPremiumName="false" PremiumRegistrationPrice="0"
      PremiumRenewalPrice="0" PremiumRestorePrice="0" PremiumTransferPrice="0"
      IcannFee="0" EapFee="0" />
  </CommandResponse>
</ApiResponse>`;
}

function premiumXml(domain: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="${domain}" Available="true" ErrorNo="0"
      Description="" IsPremiumName="true" PremiumRegistrationPrice="1499.99"
      PremiumRenewalPrice="250.00" PremiumRestorePrice="0" PremiumTransferPrice="0"
      IcannFee="0" EapFee="0" />
  </CommandResponse>
</ApiResponse>`;
}

function namecheapHandler(responseXml: string) {
  return http.get('http://localhost:9100/xml.response', () =>
    new HttpResponse(responseXml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    }),
  );
}

describe('checkAvailability — available domain', () => {
  it('returns available: true for an available domain', async () => {
    server.use(namecheapHandler(availableXml('example.com', 'true')));
    const result = await checkAvailability(cfg, 'example.com');
    expect(result.domain).toBe('example.com');
    expect(result.available).toBe(true);
    expect(result.priceUsd).toBeUndefined();
    expect(result.currency).toBeUndefined();
  });
});

describe('checkAvailability — unavailable domain', () => {
  it('returns available: false for a taken domain', async () => {
    server.use(namecheapHandler(availableXml('google.com', 'false')));
    const result = await checkAvailability(cfg, 'google.com');
    expect(result.domain).toBe('google.com');
    expect(result.available).toBe(false);
  });
});

describe('checkAvailability — premium domain', () => {
  it('populates priceUsd and currency when IsPremiumName=true', async () => {
    server.use(namecheapHandler(premiumXml('premium.com')));
    const result = await checkAvailability(cfg, 'premium.com');
    expect(result.available).toBe(true);
    expect(result.priceUsd).toBeCloseTo(1499.99);
    expect(result.currency).toBe('USD');
  });

  it('does NOT populate priceUsd when IsPremiumName=false even if price field present', async () => {
    server.use(namecheapHandler(availableXml('cheap.com', 'true')));
    const result = await checkAvailability(cfg, 'cheap.com');
    expect(result.priceUsd).toBeUndefined();
    expect(result.currency).toBeUndefined();
  });
});

describe('checkAvailability — invalid domain shape', () => {
  it('throws E_NAMECHEAP_INVALID with phase read for a bare string', async () => {
    // No server handler needed — validation fires before fetch
    await expect(checkAvailability(cfg, 'not a domain at all')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      phase: 'read',
    });
  });

  it('throws E_NAMECHEAP_INVALID for an empty string', async () => {
    await expect(checkAvailability(cfg, '')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      phase: 'read',
    });
  });

  it('throws E_NAMECHEAP_INVALID for a single label with no dot', async () => {
    await expect(checkAvailability(cfg, 'example')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      phase: 'read',
    });
  });
});

describe('checkAvailability — network failure', () => {
  it('propagates E_NAMECHEAP_NETWORK when fetch throws', async () => {
    server.use(
      http.get('http://localhost:9100/xml.response', () => HttpResponse.error()),
    );
    await expect(checkAvailability(cfg, 'example.com')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.NETWORK,
    });
  });
});
