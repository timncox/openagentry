import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  splitDomain,
  listRecords,
  setRecord,
  deleteRecord,
  parseHostsResponse,
  recordsToHostsParams,
} from '../src/dns.js';
import type { NamecheapDomainConfig } from '../src/config.js';
import type { DnsRecord } from '@openagentry/core';

const cfg: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey',
  clientIp: '1.2.3.4',
  userName: 'testuser',
  endpoint: 'http://localhost:9101/xml.response',
  useSandbox: false,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function getHostsXml(hosts: DnsRecord[]): string {
  const hostElements = hosts
    .map(
      (h, i) => `
    <host HostId="${i + 1}" Name="${h.name}" Type="${h.type}" Address="${h.value}"
      MXPref="${h.priority ?? 10}" TTL="${h.ttl ?? 1800}" AssociatedAppTitle=""
      FriendlyName="" IsActive="true" IsDDNSEnabled="false" />`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="example.com" EmailType="MXE" IsUsingOurDNS="true">
      ${hostElements}
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;
}

function setHostsOkXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.setHosts">
    <DomainDNSSetHostsResult Domain="example.com" IsSuccess="true" />
  </CommandResponse>
</ApiResponse>`;
}

function namecheapHandler(getXml: string, setXml: string = setHostsOkXml()) {
  return http.get('http://localhost:9101/xml.response', ({ request }) => {
    const url = new URL(request.url);
    const cmd = url.searchParams.get('Command');
    if (cmd === 'namecheap.domains.dns.getHosts') {
      return new HttpResponse(getXml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    if (cmd === 'namecheap.domains.dns.setHosts') {
      return new HttpResponse(setXml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    return new HttpResponse('Unexpected command', { status: 400 });
  });
}

// ---------------------------------------------------------------------------
// splitDomain
// ---------------------------------------------------------------------------

describe('splitDomain — last-dot fallback', () => {
  it('splits example.com into sld=example, tld=com', () => {
    expect(splitDomain('example.com')).toEqual({ sld: 'example', tld: 'com' });
  });

  it('splits www.example.com into sld=www.example, tld=com', () => {
    expect(splitDomain('www.example.com')).toEqual({ sld: 'www.example', tld: 'com' });
  });

  it('splits sub.domain.example.net into sld=sub.domain.example, tld=net', () => {
    expect(splitDomain('sub.domain.example.net')).toEqual({
      sld: 'sub.domain.example',
      tld: 'net',
    });
  });
});

describe('splitDomain — known double-label TLDs', () => {
  it('splits example.co.uk into sld=example, tld=co.uk', () => {
    expect(splitDomain('example.co.uk')).toEqual({ sld: 'example', tld: 'co.uk' });
  });

  it('splits sub.example.co.uk into sld=sub.example, tld=co.uk', () => {
    expect(splitDomain('sub.example.co.uk')).toEqual({ sld: 'sub.example', tld: 'co.uk' });
  });

  it('splits example.com.br into sld=example, tld=com.br', () => {
    expect(splitDomain('example.com.br')).toEqual({ sld: 'example', tld: 'com.br' });
  });

  it('splits example.com.au into sld=example, tld=com.au', () => {
    expect(splitDomain('example.com.au')).toEqual({ sld: 'example', tld: 'com.au' });
  });
});

// ---------------------------------------------------------------------------
// listRecords
// ---------------------------------------------------------------------------

describe('listRecords — happy path', () => {
  it('returns an empty array when no hosts present', async () => {
    server.use(namecheapHandler(getHostsXml([])));
    const records = await listRecords(cfg, 'example.com');
    expect(records).toEqual([]);
  });

  it('returns a single A record with correct field mapping', async () => {
    const initial: DnsRecord[] = [{ type: 'A', name: '@', value: '1.2.3.4', ttl: 1800 }];
    server.use(namecheapHandler(getHostsXml(initial)));
    const records = await listRecords(cfg, 'example.com');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: 'A', name: '@', value: '1.2.3.4', ttl: 1800 });
  });

  it('returns multiple records', async () => {
    const initial: DnsRecord[] = [
      { type: 'A', name: '@', value: '1.2.3.4', ttl: 1800 },
      { type: 'MX', name: '@', value: 'mail.example.com', ttl: 1800, priority: 10 },
      { type: 'TXT', name: '@', value: 'v=spf1 include:example.com ~all', ttl: 300 },
    ];
    server.use(namecheapHandler(getHostsXml(initial)));
    const records = await listRecords(cfg, 'example.com');
    expect(records).toHaveLength(3);
  });

  it('sends SLD and TLD as separate query params', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        capturedUrl = new URL(request.url);
        return new HttpResponse(getHostsXml([]), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );
    await listRecords(cfg, 'example.co.uk');
    expect(capturedUrl?.searchParams.get('SLD')).toBe('example');
    expect(capturedUrl?.searchParams.get('TLD')).toBe('co.uk');
  });
});

// ---------------------------------------------------------------------------
// setRecord — single-value types (A, AAAA, CNAME, NS)
// ---------------------------------------------------------------------------

describe('setRecord — replace existing A record', () => {
  it('replaces an existing A record with the same name, does not duplicate', async () => {
    const initial: DnsRecord[] = [
      { type: 'A', name: '@', value: '1.1.1.1', ttl: 1800 },
    ];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    const newRecord: DnsRecord = { type: 'A', name: '@', value: '2.2.2.2', ttl: 300 };
    const result = await setRecord(cfg, 'example.com', newRecord);
    expect(result).toEqual(newRecord);
    // Only one HostName1 in the setHosts call — no HostName2
    expect(capturedParams?.get('HostName1')).toBe('@');
    expect(capturedParams?.get('RecordType1')).toBe('A');
    expect(capturedParams?.get('Address1')).toBe('2.2.2.2');
    expect(capturedParams?.get('HostName2')).toBeNull();
  });
});

describe('setRecord — append new single-value record', () => {
  it('appends a new A record when no matching (name, type) exists', async () => {
    const initial: DnsRecord[] = [
      { type: 'A', name: '@', value: '1.1.1.1', ttl: 1800 },
    ];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    const newRecord: DnsRecord = { type: 'CNAME', name: 'www', value: 'example.com', ttl: 1800 };
    await setRecord(cfg, 'example.com', newRecord);
    // Two records should be in the setHosts call
    expect(capturedParams?.get('HostName1')).toBe('@');
    expect(capturedParams?.get('RecordType1')).toBe('A');
    expect(capturedParams?.get('HostName2')).toBe('www');
    expect(capturedParams?.get('RecordType2')).toBe('CNAME');
    expect(capturedParams?.get('HostName3')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setRecord — multi-value types (TXT, MX, SRV)
// ---------------------------------------------------------------------------

describe('setRecord — replace exact TXT triple', () => {
  it('replaces a TXT with the exact same (name, type, value)', async () => {
    const existing: DnsRecord = {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:example.com ~all',
      ttl: 300,
    };
    const initial: DnsRecord[] = [existing];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    const updated: DnsRecord = {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:example.com ~all',
      ttl: 600, // changed TTL only
    };
    await setRecord(cfg, 'example.com', updated);
    // Should still be one record (replacement, not append)
    expect(capturedParams?.get('HostName1')).toBe('@');
    expect(capturedParams?.get('TTL1')).toBe('600');
    expect(capturedParams?.get('HostName2')).toBeNull();
  });
});

describe('setRecord — append new TXT (different value, same name+type)', () => {
  it('appends a second TXT when value differs from existing', async () => {
    const initial: DnsRecord[] = [
      { type: 'TXT', name: '@', value: 'v=spf1 include:example.com ~all', ttl: 300 },
    ];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    const domainKey: DnsRecord = {
      type: 'TXT',
      name: '@',
      value: 'google-site-verification=abc123',
      ttl: 300,
    };
    await setRecord(cfg, 'example.com', domainKey);
    // Two TXTs: original SPF + new verification
    expect(capturedParams?.get('HostName1')).toBe('@');
    expect(capturedParams?.get('RecordType1')).toBe('TXT');
    expect(capturedParams?.get('HostName2')).toBe('@');
    expect(capturedParams?.get('RecordType2')).toBe('TXT');
    expect(capturedParams?.get('Address2')).toBe('google-site-verification=abc123');
    expect(capturedParams?.get('HostName3')).toBeNull();
  });
});

describe('setRecord — MX MXPref round-trip', () => {
  it('preserves MXPref when setting an MX record', async () => {
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml([]), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    const mx: DnsRecord = { type: 'MX', name: '@', value: 'mail.example.com', ttl: 1800, priority: 20 };
    await setRecord(cfg, 'example.com', mx);
    expect(capturedParams?.get('MXPref1')).toBe('20');
  });
});

// ---------------------------------------------------------------------------
// deleteRecord
// ---------------------------------------------------------------------------

describe('deleteRecord — removes matching record, preserves others', () => {
  it('removes one A record and preserves remaining records', async () => {
    const initial: DnsRecord[] = [
      { type: 'A', name: '@', value: '1.1.1.1', ttl: 1800 },
      { type: 'MX', name: '@', value: 'mail.example.com', ttl: 1800, priority: 10 },
    ];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    await deleteRecord(cfg, 'example.com', { type: 'A', name: '@', value: '1.1.1.1' });
    // Only MX record remains
    expect(capturedParams?.get('RecordType1')).toBe('MX');
    expect(capturedParams?.get('HostName2')).toBeNull();
  });
});

describe('deleteRecord — idempotent no-op', () => {
  it('writes unchanged list when record does not exist (no error)', async () => {
    const initial: DnsRecord[] = [
      { type: 'A', name: '@', value: '1.1.1.1', ttl: 1800 },
    ];
    let setHostsCallCount = 0;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        setHostsCallCount++;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    // This record doesn't exist; deleteRecord should not error
    await expect(
      deleteRecord(cfg, 'example.com', { type: 'TXT', name: '@', value: 'nonexistent' }),
    ).resolves.toBeUndefined();
    // setHosts is still called (writes the unchanged list back)
    expect(setHostsCallCount).toBe(1);
  });
});

describe('deleteRecord — multi-value TXT: removes only matching value', () => {
  it('removes only the TXT with the matching value, preserves the other', async () => {
    const initial: DnsRecord[] = [
      { type: 'TXT', name: '@', value: 'v=spf1 include:example.com ~all', ttl: 300 },
      { type: 'TXT', name: '@', value: 'google-site-verification=abc123', ttl: 300 },
    ];
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('http://localhost:9101/xml.response', ({ request }) => {
        const url = new URL(request.url);
        const cmd = url.searchParams.get('Command');
        if (cmd === 'namecheap.domains.dns.getHosts') {
          return new HttpResponse(getHostsXml(initial), {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }
        capturedParams = url.searchParams;
        return new HttpResponse(setHostsOkXml(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );

    await deleteRecord(cfg, 'example.com', {
      type: 'TXT',
      name: '@',
      value: 'google-site-verification=abc123',
    });
    // Only SPF TXT remains
    expect(capturedParams?.get('HostName1')).toBe('@');
    expect(capturedParams?.get('RecordType1')).toBe('TXT');
    expect(capturedParams?.get('Address1')).toBe('v=spf1 include:example.com ~all');
    expect(capturedParams?.get('HostName2')).toBeNull();
  });
});
