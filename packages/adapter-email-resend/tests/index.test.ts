import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ENV_KEYS = ['OA_RESEND_API_KEY', 'OA_RESEND_ENDPOINT'] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe('default export — adapter shape exposed without env', () => {
  it('exposes category and id without triggering init', async () => {
    clearEnv();
    vi.resetModules();
    const mod = await import('../src/index.js');
    expect(mod.default.category).toBe('email');
    expect(mod.default.id).toBe('email-resend');
  });
});

describe('default export — init errors', () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });

  it('throws E_RESEND_AUTH/init when OA_RESEND_API_KEY is missing', async () => {
    const mod = await import('../src/index.js');
    await expect(
      mod.default.send({ to: 'a@b.com', from: 'c@d.com', subject: 's' }),
    ).rejects.toMatchObject({ code: 'E_RESEND_AUTH', phase: 'init' });
  });

  it('throws E_RESEND_AUTH/init when OA_RESEND_ENDPOINT is malformed', async () => {
    process.env.OA_RESEND_API_KEY = 're_x';
    process.env.OA_RESEND_ENDPOINT = 'not-a-url';
    const mod = await import('../src/index.js');
    await expect(
      mod.default.send({ to: 'a@b.com', from: 'c@d.com', subject: 's' }),
    ).rejects.toMatchObject({ code: 'E_RESEND_AUTH', phase: 'init' });
  });
});

describe('default export — env-driven success', () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });

  it('builds the adapter from env and round-trips a send', async () => {
    process.env.OA_RESEND_API_KEY = 're_test';
    server.use(
      http.post('https://api.resend.com/emails', () => HttpResponse.json({ id: 'env-1' })),
    );
    const mod = await import('../src/index.js');
    const result = await mod.default.send({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 's',
      text: 't',
    });
    expect(result).toEqual({ id: 'env-1', status: 'queued' });
  });

  it('honors OA_RESEND_ENDPOINT override', async () => {
    process.env.OA_RESEND_API_KEY = 're_test';
    process.env.OA_RESEND_ENDPOINT = 'http://localhost:9876';
    server.use(
      http.post('http://localhost:9876/emails', () => HttpResponse.json({ id: 'env-2' })),
    );
    const mod = await import('../src/index.js');
    const result = await mod.default.send({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 's',
    });
    expect(result.id).toBe('env-2');
  });

  it('caches the underlying adapter across send() calls', async () => {
    process.env.OA_RESEND_API_KEY = 're_test';
    let callCount = 0;
    server.use(
      http.post('https://api.resend.com/emails', () => {
        callCount += 1;
        return HttpResponse.json({ id: `m${callCount}` });
      }),
    );
    const mod = await import('../src/index.js');
    await mod.default.send({ to: 'a@b.com', from: 'c@d.com', subject: '1' });
    await mod.default.send({ to: 'a@b.com', from: 'c@d.com', subject: '2' });
    expect(callCount).toBe(2);
  });
});
