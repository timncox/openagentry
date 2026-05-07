import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { purchase, parseNamecheapDate } from '../src/purchase.js';
import type { NamecheapDomainConfig } from '../src/config.js';
import { NAMECHEAP_ERROR_CODES } from '../src/errors.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const contact = {
  firstName: 'Tim',
  lastName: 'Cox',
  address1: '530 Lafayette Ave',
  city: 'Brooklyn',
  stateProvince: 'NY',
  postalCode: '11205',
  country: 'US',
  phone: '+1.5551234567',
  email: 'tim@example.com',
};

const cfgWithContact: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey',
  clientIp: '1.2.3.4',
  userName: 'testuser',
  endpoint: 'http://localhost:9103/xml.response',
  useSandbox: false,
  contact,
};

const cfgWithoutContact: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey',
  clientIp: '1.2.3.4',
  userName: 'testuser',
  endpoint: 'http://localhost:9103/xml.response',
  useSandbox: false,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function createOkXml(domain: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.create">
    <DomainCreateResult Domain="${domain}" Registered="true" ChargedAmount="11.98"
      DomainID="12345678" OrderID="98765" TransactionID="44321" WhoisguardEnable="true"
      FreePositiveSSL="false" NonRealTimeDomain="false" />
  </CommandResponse>
</ApiResponse>`;
}

function getInfoXml(
  domain: string,
  createdDate: string,
  expiredDate: string,
  autoRenew: 'true' | 'false' = 'true',
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.getInfo">
    <DomainGetInfoResult Status="Ok" ID="12345678" DomainName="${domain}"
      OwnerName="testuser" IsOwner="true" IsPremium="false" IsAutoRenew="${autoRenew}">
      <DomainDetails>
        <CreatedDate>${createdDate}</CreatedDate>
        <ExpiredDate>${expiredDate}</ExpiredDate>
      </DomainDetails>
    </DomainGetInfoResult>
  </CommandResponse>
</ApiResponse>`;
}

function errorXml(number: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="${number}">${message}</Error>
  </Errors>
</ApiResponse>`;
}

function namecheapHandler(
  domain: string,
  createdDate: string,
  expiredDate: string,
  autoRenew: 'true' | 'false' = 'true',
  getInfoXmlOverride?: string,
) {
  return http.get('http://localhost:9103/xml.response', ({ request }) => {
    const url = new URL(request.url);
    const cmd = url.searchParams.get('Command');
    if (cmd === 'namecheap.domains.create') {
      return new HttpResponse(createOkXml(domain), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    if (cmd === 'namecheap.domains.getInfo') {
      const xml = getInfoXmlOverride ?? getInfoXml(domain, createdDate, expiredDate, autoRenew);
      return new HttpResponse(xml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    return new HttpResponse('Unexpected command', { status: 400 });
  });
}

// ---------------------------------------------------------------------------
// parseNamecheapDate — unit tests (no MSW needed)
// ---------------------------------------------------------------------------

describe('parseNamecheapDate', () => {
  it('converts 05/07/2026 to 2026-05-07T00:00:00.000Z', () => {
    expect(parseNamecheapDate('05/07/2026')).toBe('2026-05-07T00:00:00.000Z');
  });

  it('converts 01/01/2025 to 2025-01-01T00:00:00.000Z', () => {
    expect(parseNamecheapDate('01/01/2025')).toBe('2025-01-01T00:00:00.000Z');
  });

  it('converts 12/31/2030 to 2030-12-31T00:00:00.000Z', () => {
    expect(parseNamecheapDate('12/31/2030')).toBe('2030-12-31T00:00:00.000Z');
  });

  it('throws on malformed input (wrong separator)', () => {
    expect(() => parseNamecheapDate('2026-05-07')).toThrow();
  });

  it('throws on invalid date values', () => {
    expect(() => parseNamecheapDate('13/99/2026')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// purchase — missing contact
// ---------------------------------------------------------------------------

describe('purchase — missing contact', () => {
  it('throws E_NAMECHEAP_INVALID with phase write when cfg.contact is absent', async () => {
    // No server handler needed — validation fires before fetch
    await expect(purchase(cfgWithoutContact, 'example.com')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      phase: 'write',
    });
  });

  it('includes all 9 contact env-var names in context.missing', async () => {
    let caught: unknown;
    try {
      await purchase(cfgWithoutContact, 'example.com');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const missing: string[] =
      (caught as { context?: { missing?: string[] } })?.context?.missing ?? [];
    const expectedVars = [
      'OA_NAMECHEAP_CONTACT_FIRST_NAME',
      'OA_NAMECHEAP_CONTACT_LAST_NAME',
      'OA_NAMECHEAP_CONTACT_ADDRESS1',
      'OA_NAMECHEAP_CONTACT_CITY',
      'OA_NAMECHEAP_CONTACT_STATE_PROVINCE',
      'OA_NAMECHEAP_CONTACT_POSTAL_CODE',
      'OA_NAMECHEAP_CONTACT_COUNTRY',
      'OA_NAMECHEAP_CONTACT_PHONE',
      'OA_NAMECHEAP_CONTACT_EMAIL',
    ];
    for (const varName of expectedVars) {
      expect(missing).toContain(varName);
    }
    expect(missing).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// purchase — happy path
// ---------------------------------------------------------------------------

describe('purchase — happy path', () => {
  it('returns a Domain with correct field mapping on success', async () => {
    server.use(namecheapHandler('example.com', '05/07/2026', '05/07/2027'));
    const result = await purchase(cfgWithContact, 'example.com');
    expect(result.domain).toBe('example.com');
    expect(result.registrar).toBe('namecheap');
    expect(result.registeredAt).toBe('2026-05-07T00:00:00.000Z');
    expect(result.expiresAt).toBe('2027-05-07T00:00:00.000Z');
    expect(result.autoRenew).toBe(true);
  });

  it('sends all 4 contact role param sets (Registrant, Tech, Admin, AuxBilling)', async () => {
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9103/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.create') {
          capturedParams = url.searchParams;
          return new HttpResponse(createOkXml('example.com'), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        return new HttpResponse(getInfoXml('example.com', '05/07/2026', '05/07/2027'), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    await purchase(cfgWithContact, 'example.com');

    // Check all four role prefixes are present with expected first name
    for (const role of ['Registrant', 'Tech', 'Admin', 'AuxBilling']) {
      expect(capturedParams?.get(`${role}FirstName`)).toBe('Tim');
      expect(capturedParams?.get(`${role}LastName`)).toBe('Cox');
      expect(capturedParams?.get(`${role}EmailAddress`)).toBe('tim@example.com');
    }
  });

  it('passes Years param (default 1) to namecheap.domains.create', async () => {
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9103/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.create') {
          capturedParams = url.searchParams;
          return new HttpResponse(createOkXml('example.com'), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        return new HttpResponse(getInfoXml('example.com', '05/07/2026', '05/07/2027'), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );
    await purchase(cfgWithContact, 'example.com');
    expect(capturedParams?.get('Years')).toBe('1');
  });

  it('passes Years=3 when years=3 is supplied', async () => {
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9103/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.create') {
          capturedParams = url.searchParams;
          return new HttpResponse(createOkXml('example.com'), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        return new HttpResponse(getInfoXml('example.com', '05/07/2026', '05/07/2029'), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );
    await purchase(cfgWithContact, 'example.com', 3);
    expect(capturedParams?.get('Years')).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// purchase — autoRenew flag
// ---------------------------------------------------------------------------

describe('purchase — autoRenew flag', () => {
  it('returns autoRenew: true when IsAutoRenew="true"', async () => {
    server.use(namecheapHandler('example.com', '05/07/2026', '05/07/2027', 'true'));
    const result = await purchase(cfgWithContact, 'example.com');
    expect(result.autoRenew).toBe(true);
  });

  it('returns autoRenew: false when IsAutoRenew="false"', async () => {
    server.use(namecheapHandler('example.com', '05/07/2026', '05/07/2027', 'false'));
    const result = await purchase(cfgWithContact, 'example.com');
    expect(result.autoRenew).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// purchase — getInfo follow-up failure propagates
// ---------------------------------------------------------------------------

describe('purchase — getInfo failure propagates', () => {
  it('propagates an error from getInfo even when create succeeded', async () => {
    // create succeeds; getInfo returns a Namecheap error envelope
    server.use(
      http.get('http://localhost:9103/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.create') {
          return new HttpResponse(createOkXml('example.com'), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        // getInfo returns an upstream error
        return new HttpResponse(errorXml('5050900', 'Domain not found'), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    await expect(purchase(cfgWithContact, 'example.com')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND,
    });
  });
});

// ---------------------------------------------------------------------------
// purchase — network failure
// ---------------------------------------------------------------------------

describe('purchase — network failure', () => {
  it('propagates E_NAMECHEAP_NETWORK when fetch throws on create', async () => {
    server.use(
      http.get('http://localhost:9103/xml.response', () => HttpResponse.error()),
    );
    await expect(purchase(cfgWithContact, 'example.com')).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.NETWORK,
    });
  });
});
