import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { namecheapFetch } from '../src/http.js';
import type { NamecheapDomainConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ENDPOINT = 'https://api.namecheap.com/xml.response';

const cfg: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey_secret',
  userName: 'testuser',
  clientIp: '1.2.3.4',
  endpoint: TEST_ENDPOINT,
  useSandbox: false,
};

function okXml(commandType: string, innerXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors />
  <CommandResponse Type="${commandType}">${innerXml}</CommandResponse>
</ApiResponse>`;
}

function errorXml(number: string, message: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="${number}">${message}</Error>
  </Errors>
  <CommandResponse />
</ApiResponse>`;
}

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('namecheapFetch — happy path', () => {
  it('returns parsed ApiResponseEnvelope on Status=OK', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(
          okXml('namecheap.domains.check', '<DomainCheckResult Domain="example.com" Available="true"/>'),
          { headers: { 'Content-Type': 'text/xml' } },
        ),
      ),
    );
    const env = await namecheapFetch(cfg, 'namecheap.domains.check', { DomainList: 'example.com' }, 'read');
    expect(env.ApiResponse['@_Status']).toBe('OK');
    expect(env.ApiResponse.CommandResponse).toBeDefined();
  });

  it('adds ApiUser, ApiKey, UserName, ClientIp, Command to the query string', async () => {
    let receivedUrl: string | undefined;
    server.use(
      http.get(TEST_ENDPOINT, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.text(
          okXml('namecheap.domains.check', ''),
          { headers: { 'Content-Type': 'text/xml' } },
        );
      }),
    );
    await namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read');
    expect(receivedUrl).toBeDefined();
    const qs = new URL(receivedUrl!).searchParams;
    expect(qs.get('ApiUser')).toBe('testuser');
    expect(qs.get('ApiKey')).toBe('testkey_secret');
    expect(qs.get('UserName')).toBe('testuser');
    expect(qs.get('ClientIp')).toBe('1.2.3.4');
    expect(qs.get('Command')).toBe('namecheap.domains.check');
  });

  it('forwards caller-supplied params to the query string', async () => {
    let receivedUrl: string | undefined;
    server.use(
      http.get(TEST_ENDPOINT, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.text(okXml('namecheap.domains.check', ''), {
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );
    await namecheapFetch(cfg, 'namecheap.domains.check', { DomainList: 'example.com', Years: '2' }, 'read');
    const qs = new URL(receivedUrl!).searchParams;
    expect(qs.get('DomainList')).toBe('example.com');
    expect(qs.get('Years')).toBe('2');
  });

  it('omits undefined caller params from the query string', async () => {
    let receivedUrl: string | undefined;
    server.use(
      http.get(TEST_ENDPOINT, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.text(okXml('namecheap.domains.check', ''), {
          headers: { 'Content-Type': 'text/xml' },
        });
      }),
    );
    await namecheapFetch(cfg, 'namecheap.domains.check', { DomainList: 'example.com', Optional: undefined }, 'read');
    const qs = new URL(receivedUrl!).searchParams;
    expect(qs.has('Optional')).toBe(false);
    expect(qs.get('DomainList')).toBe('example.com');
  });
});

// ---------------------------------------------------------------------------
// Error envelope → AgentryError code mapping
// ---------------------------------------------------------------------------

describe('namecheapFetch — error envelope mapping', () => {
  it('Number=1010101 (bad API key) → E_NAMECHEAP_AUTH', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('1010101', 'Invalid ApiKey'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_AUTH', phase: 'read' });
  });

  it('Number=1011147 (IP not whitelisted) → E_NAMECHEAP_IP_NOT_WHITELISTED', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('1011147', 'IP not whitelisted'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_IP_NOT_WHITELISTED', phase: 'read' });
  });

  it('Number=2030280 (domain not found) → E_NAMECHEAP_DOMAIN_NOT_FOUND', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('2030280', 'Domain not in user account'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.dns.getHosts', { SLD: 'example', TLD: 'com' }, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_DOMAIN_NOT_FOUND', phase: 'read' });
  });

  it('Number=2011280 (invalid domain) → E_NAMECHEAP_INVALID', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('2011280', 'Invalid domain name'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', { DomainList: 'not-a-domain-at-all' }, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_INVALID' });
  });

  it('Number=4023273 (rate limit) → E_NAMECHEAP_RATE_LIMIT', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('4023273', 'Too many requests'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_RATE_LIMIT' });
  });

  it('unmapped Number → E_NAMECHEAP_UPSTREAM', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('9999999', 'Unknown error'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_UPSTREAM' });
  });

  it('error context includes namecheapNumber and namecheapMessage', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        HttpResponse.text(errorXml('1010101', 'API key is invalid'), {
          headers: { 'Content-Type': 'text/xml' },
        }),
      ),
    );
    try {
      await namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({
        code: 'E_NAMECHEAP_AUTH',
        context: {
          namecheapNumber: '1010101',
          namecheapMessage: 'API key is invalid',
        },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP-level errors
// ---------------------------------------------------------------------------

describe('namecheapFetch — HTTP errors', () => {
  it('HTTP 500 → E_NAMECHEAP_UPSTREAM', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        new HttpResponse('<html>Internal Server Error</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_UPSTREAM', phase: 'read' });
  });

  it('HTTP 502 → E_NAMECHEAP_UPSTREAM with httpStatus in context', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        new HttpResponse('Bad Gateway', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );
    try {
      await namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({
        code: 'E_NAMECHEAP_UPSTREAM',
        context: { httpStatus: 502 },
      });
    }
  });

  it('HTTP 403 (4xx) → E_NAMECHEAP_AUTH (handled by httpToNamecheapError)', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () =>
        new HttpResponse('Forbidden', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_AUTH' });
  });
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe('namecheapFetch — network failure', () => {
  it('fetch rejection (simulated network error) → E_NAMECHEAP_NETWORK', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () => HttpResponse.error()),
    );
    await expect(
      namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read'),
    ).rejects.toMatchObject({ code: 'E_NAMECHEAP_NETWORK', phase: 'read' });
  });

  it('network error includes cause in context', async () => {
    server.use(
      http.get(TEST_ENDPOINT, () => HttpResponse.error()),
    );
    try {
      await namecheapFetch(cfg, 'namecheap.domains.check', {}, 'read');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E_NAMECHEAP_NETWORK' });
      expect((err as { cause?: unknown }).cause).toBeDefined();
    }
  });
});
