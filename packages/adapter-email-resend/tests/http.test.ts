import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { resendFetch } from '../src/http.js';
import type { ResendEmailConfig } from '../src/config.js';

const cfg: ResendEmailConfig = {
  apiKey: 're_test_key',
  endpoint: 'https://api.resend.com',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('resendFetch — happy path', () => {
  it('adds Authorization header with Bearer prefix', async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.post('https://api.resend.com/emails', ({ request }) => {
        receivedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ id: 'msg-1' });
      }),
    );
    const res = await resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send');
    await res.json();
    expect(receivedAuth).toBe('Bearer re_test_key');
  });

  it('sets Content-Type: application/json by default when body is present', async () => {
    let receivedCt: string | null = null;
    server.use(
      http.post('https://api.resend.com/emails', ({ request }) => {
        receivedCt = request.headers.get('Content-Type');
        return HttpResponse.json({ id: 'msg-2' });
      }),
    );
    await resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send');
    expect(receivedCt).toBe('application/json');
  });

  it('does not override Content-Type when caller supplied one', async () => {
    let receivedCt: string | null = null;
    server.use(
      http.post('https://api.resend.com/emails', ({ request }) => {
        receivedCt = request.headers.get('Content-Type');
        return HttpResponse.json({ id: 'msg-3' });
      }),
    );
    await resendFetch(
      cfg,
      '/emails',
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } },
      'send',
    );
    expect(receivedCt).toBe('text/plain');
  });

  it('returns the Response on 2xx', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ id: 'msg-ok' }, { status: 200 }),
      ),
    );
    const res = await resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'msg-ok' });
  });
});

describe('resendFetch — error paths', () => {
  it('throws E_RESEND_AUTH on 401', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ name: 'missing_api_key' }, { status: 401 }),
      ),
    );
    await expect(
      resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send'),
    ).rejects.toMatchObject({ code: 'E_RESEND_AUTH', phase: 'send' });
  });

  it('throws E_RESEND_INVALID on 422', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ name: 'invalid_parameter' }, { status: 422 }),
      ),
    );
    await expect(
      resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send'),
    ).rejects.toMatchObject({ code: 'E_RESEND_INVALID' });
  });

  it('throws E_RESEND_RATE_LIMIT on 429 and extracts Retry-After', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({}, { status: 429, headers: { 'Retry-After': '12' } }),
      ),
    );
    try {
      await resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toMatchObject({
        code: 'E_RESEND_RATE_LIMIT',
        context: { retryAfter: 12 },
      });
    }
  });

  it('throws E_RESEND_UPSTREAM on 500', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    await expect(
      resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send'),
    ).rejects.toMatchObject({ code: 'E_RESEND_UPSTREAM' });
  });

  it('throws E_RESEND_NETWORK when fetch rejects', async () => {
    // MSW's HttpResponse.error() makes the underlying fetch() reject as if
    // the network failed (DNS, connection refused, TLS error, etc.). The
    // resendFetch chokepoint catches that and re-throws as E_RESEND_NETWORK.
    server.use(
      http.post('https://api.resend.com/emails', () => HttpResponse.error()),
    );
    await expect(
      resendFetch(cfg, '/emails', { method: 'POST', body: '{}' }, 'send'),
    ).rejects.toMatchObject({ code: 'E_RESEND_NETWORK' });
  });
});
