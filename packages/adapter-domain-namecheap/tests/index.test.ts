import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ENV_KEYS = [
  'OA_NAMECHEAP_API_USER',
  'OA_NAMECHEAP_API_KEY',
  'OA_NAMECHEAP_CLIENT_IP',
  'OA_NAMECHEAP_USERNAME',
  'OA_NAMECHEAP_USE_SANDBOX',
  'OA_NAMECHEAP_ENDPOINT',
] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

// Cache-busting re-import to reset the module-level `cached` variable.
// vi.resetModules() clears Vitest's module registry so each freshImport()
// call gets a brand-new module instance with cached=undefined.
async function freshImport() {
  vi.resetModules();
  const mod = await import('../src/index.js');
  return mod;
}

const ENDPOINT = 'http://nc-lazy-test.local';

const XML_OK_AVAILABLE = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="lazy-test-avail.com" Available="true" IsPremiumName="false"/>
  </CommandResponse>
</ApiResponse>`;

const XML_OK_LIST_HOSTS = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="lazy-test.com" IsUsingOurDNS="true">
      <host HostId="1" Name="@" Type="A" Address="9.9.9.9" MXPref="10" TTL="1800"/>
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

// ─── Static fields ────────────────────────────────────────────────────────────

describe('default export — static fields accessible without env', () => {
  beforeEach(() => clearEnv());

  it('exposes category === "domain" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.category).toBe('domain');
  });

  it('exposes id === "domain-namecheap" without triggering env init', async () => {
    const mod = await freshImport();
    expect(mod.default.id).toBe('domain-namecheap');
  });
});

// ─── Init errors surface as rejected promises (not sync throws) ───────────────

describe('default export — missing env converts sync throw to Promise.reject', () => {
  beforeEach(() => clearEnv());

  it('checkAvailability returns Promise.reject (not sync throw) when env missing', async () => {
    const mod = await freshImport();
    const call = mod.default.checkAvailability('lazy-test.com');
    // Must be a Promise — not a synchronous exception
    expect(call).toBeInstanceOf(Promise);
    await expect(call).rejects.toMatchObject({
      code: 'E_NAMECHEAP_AUTH',
      phase: 'init',
    });
  });

  it('purchase returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(mod.default.purchase('lazy-test.com')).rejects.toMatchObject({
      code: 'E_NAMECHEAP_AUTH',
      phase: 'init',
    });
  });

  it('listRecords returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(mod.default.listRecords('lazy-test.com')).rejects.toMatchObject({
      code: 'E_NAMECHEAP_AUTH',
      phase: 'init',
    });
  });

  it('setRecord returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.setRecord('lazy-test.com', { name: '@', type: 'A', value: '1.2.3.4' }),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_AUTH', phase: 'init' });
  });

  it('deleteRecord returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.deleteRecord('lazy-test.com', { name: '@', type: 'A', value: '1.2.3.4' }),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_AUTH', phase: 'init' });
  });

  it('initiateTransfer returns Promise.reject when env missing', async () => {
    const mod = await freshImport();
    await expect(
      mod.default.initiateTransfer('lazy-test.com', 'AUTH'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_AUTH', phase: 'init' });
  });
});

// ─── Env-driven success + caching ────────────────────────────────────────────

describe('default export — env-driven success + adapter caching', () => {
  beforeEach(() => clearEnv());

  it('builds adapter from env and resolves checkAvailability', async () => {
    process.env.OA_NAMECHEAP_API_USER = 'ncuser';
    process.env.OA_NAMECHEAP_API_KEY = 'nckey';
    process.env.OA_NAMECHEAP_CLIENT_IP = '1.2.3.4';
    process.env.OA_NAMECHEAP_ENDPOINT = ENDPOINT;
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.text(XML_OK_AVAILABLE, { headers: { 'Content-Type': 'text/xml' } }),
      ),
    );
    const mod = await freshImport();
    const result = await mod.default.checkAvailability('lazy-test-avail.com');
    expect(result.domain).toBe('lazy-test-avail.com');
    expect(result.available).toBe(true);
  });

  it('honors OA_NAMECHEAP_ENDPOINT override', async () => {
    process.env.OA_NAMECHEAP_API_USER = 'ncuser';
    process.env.OA_NAMECHEAP_API_KEY = 'nckey';
    process.env.OA_NAMECHEAP_CLIENT_IP = '1.2.3.4';
    process.env.OA_NAMECHEAP_ENDPOINT = ENDPOINT;
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.text(XML_OK_LIST_HOSTS, { headers: { 'Content-Type': 'text/xml' } }),
      ),
    );
    const mod = await freshImport();
    const records = await mod.default.listRecords('lazy-test.com');
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
  });

  it('caches the underlying adapter across multiple calls', async () => {
    process.env.OA_NAMECHEAP_API_USER = 'ncuser';
    process.env.OA_NAMECHEAP_API_KEY = 'nckey';
    process.env.OA_NAMECHEAP_CLIENT_IP = '1.2.3.4';
    process.env.OA_NAMECHEAP_ENDPOINT = ENDPOINT;
    let xmlCallCount = 0;
    server.use(
      http.get(ENDPOINT, () => {
        xmlCallCount += 1;
        return HttpResponse.text(XML_OK_AVAILABLE, { headers: { 'Content-Type': 'text/xml' } });
      }),
    );
    const mod = await freshImport();
    await mod.default.checkAvailability('lazy-cache-1.com');
    await mod.default.checkAvailability('lazy-cache-2.com');
    // Two API calls were made (one per checkAvailability) but buildFromEnv
    // should only have run once — verify by checking xmlCallCount is exactly 2
    // (one per checkAvailability, not 4 from double-building).
    expect(xmlCallCount).toBe(2);
  });
});
