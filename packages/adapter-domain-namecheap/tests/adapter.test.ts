import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createNamecheapDomainAdapter } from '../src/adapter.js';
import { NAMECHEAP_ERROR_CODES } from '../src/errors.js';

// ───── Canned XML responses ───────────────────────────────────────────────────

const XML_OK_AVAILABLE = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="example-adapter-test.com" Available="true" IsPremiumName="false"/>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_LIST_HOSTS = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="example.com" IsUsingOurDNS="true">
      <host HostId="1" Name="@" Type="A" Address="1.2.3.4" MXPref="10" TTL="1800"/>
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_SET_HOSTS = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.setHosts">
    <DomainDNSSetHostsResult Domain="example.com" IsSuccess="true"/>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_PURCHASE = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.create">
    <DomainCreateResult Domain="factory-test.com" Registered="true"/>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_GET_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.getInfo">
    <DomainGetInfoResult Status="Ok">
      <DomainDetails DomainName="factory-test.com" IsAutoRenew="true">
        <CreatedDate>05/01/2026</CreatedDate>
        <ExpiredDate>05/01/2027</ExpiredDate>
      </DomainDetails>
    </DomainGetInfoResult>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_TRANSFER = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.transfer.create">
    <DomainTransferCreateResult TransferID="77001" StatusID="10" Status="Inprogress"/>
  </CommandResponse>
</ApiResponse>`;

const ENDPOINT = 'http://nc-factory-test.local';

// ───── MSW server ─────────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ───── Shared config ──────────────────────────────────────────────────────────

const BASE_CFG = {
  apiUser: 'ncuser',
  apiKey: 'nckey',
  clientIp: '1.2.3.4',
  endpoint: ENDPOINT,
  contact: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    address1: '123 Babbage St',
    city: 'London',
    stateProvince: 'London',
    postalCode: 'EC1A 1BB',
    country: 'GB',
    phone: '+44.2012345678',
    email: 'ada@example.com',
  },
};

// ───── Factory shape ──────────────────────────────────────────────────────────

describe('createNamecheapDomainAdapter — factory shape', () => {
  it('returns a frozen object', () => {
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('exposes category === "domain"', () => {
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    expect(adapter.category).toBe('domain');
  });

  it('exposes id === "domain-namecheap"', () => {
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    expect(adapter.id).toBe('domain-namecheap');
  });

  it('exposes all six DomainAdapter methods', () => {
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    expect(typeof adapter.checkAvailability).toBe('function');
    expect(typeof adapter.purchase).toBe('function');
    expect(typeof adapter.listRecords).toBe('function');
    expect(typeof adapter.setRecord).toBe('function');
    expect(typeof adapter.deleteRecord).toBe('function');
    expect(typeof adapter.initiateTransfer).toBe('function');
  });
});

// ───── Config validation guard ────────────────────────────────────────────────

describe('createNamecheapDomainAdapter — config validation', () => {
  it('throws E_NAMECHEAP_SCHEMA when apiUser is missing', () => {
    expect(() =>
      createNamecheapDomainAdapter({ apiKey: 'k', clientIp: '1.2.3.4' } as never),
    ).toThrow();
  });

  it('thrown error carries code E_NAMECHEAP_SCHEMA', () => {
    try {
      createNamecheapDomainAdapter({} as never);
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe(NAMECHEAP_ERROR_CODES.SCHEMA);
    }
  });

  it('throws when apiKey is an empty string', () => {
    expect(() =>
      createNamecheapDomainAdapter({ apiUser: 'u', apiKey: '', clientIp: '1.2.3.4' }),
    ).toThrow();
  });
});

// ───── Method delegation smoke tests ─────────────────────────────────────────

describe('createNamecheapDomainAdapter — method delegation', () => {
  it('checkAvailability delegates to availability.ts and returns correct shape', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.text(XML_OK_AVAILABLE, { headers: { 'Content-Type': 'text/xml' } })),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    const result = await adapter.checkAvailability('example-adapter-test.com');
    expect(result.domain).toBe('example-adapter-test.com');
    expect(result.available).toBe(true);
  });

  it('listRecords delegates to dns.ts and returns an array', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.text(XML_OK_LIST_HOSTS, { headers: { 'Content-Type': 'text/xml' } })),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    const records = await adapter.listRecords('example.com');
    expect(Array.isArray(records)).toBe(true);
    expect(records[0].type).toBe('A');
  });

  it('setRecord delegates to dns.ts and resolves to the record', async () => {
    // setRecord is a read-modify-write: first getHosts, then setHosts
    let callCount = 0;
    server.use(
      http.get(ENDPOINT, () => {
        callCount += 1;
        const xml = callCount === 1 ? XML_OK_LIST_HOSTS : XML_OK_SET_HOSTS;
        return HttpResponse.text(xml, { headers: { 'Content-Type': 'text/xml' } });
      }),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    const record = { name: 'sub', type: 'A' as const, value: '5.6.7.8' };
    const result = await adapter.setRecord('example.com', record);
    expect(result.name).toBe('sub');
    expect(result.type).toBe('A');
    expect(result.value).toBe('5.6.7.8');
  });

  it('deleteRecord delegates to dns.ts and resolves without error', async () => {
    let callCount = 0;
    server.use(
      http.get(ENDPOINT, () => {
        callCount += 1;
        const xml = callCount === 1 ? XML_OK_LIST_HOSTS : XML_OK_SET_HOSTS;
        return HttpResponse.text(xml, { headers: { 'Content-Type': 'text/xml' } });
      }),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    await expect(
      adapter.deleteRecord('example.com', { name: '@', type: 'A', value: '1.2.3.4' }),
    ).resolves.toBeUndefined();
  });

  it('purchase delegates to purchase.ts and returns a Domain', async () => {
    let callCount = 0;
    server.use(
      http.get(ENDPOINT, () => {
        callCount += 1;
        const xml = callCount === 1 ? XML_OK_PURCHASE : XML_OK_GET_INFO;
        return HttpResponse.text(xml, { headers: { 'Content-Type': 'text/xml' } });
      }),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    const domain = await adapter.purchase('factory-test.com', 1);
    expect(domain.domain).toBe('factory-test.com');
    expect(domain.registrar).toBe('namecheap');
  });

  it('initiateTransfer delegates to transfer.ts and returns a DomainTransfer', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.text(XML_OK_TRANSFER, { headers: { 'Content-Type': 'text/xml' } })),
    );
    const adapter = createNamecheapDomainAdapter(BASE_CFG);
    const result = await adapter.initiateTransfer('factory-test.com', 'AUTH123');
    expect(result.domain).toBe('factory-test.com');
    expect(result.status).toBe('pending');
    expect(typeof result.transferId).toBe('string');
  });
});
