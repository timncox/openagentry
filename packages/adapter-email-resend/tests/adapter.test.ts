import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createResendEmailAdapter } from '../src/adapter.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createResendEmailAdapter — factory shape', () => {
  it('returns a frozen object with category and id', () => {
    const adapter = createResendEmailAdapter({ apiKey: 're_x' });
    expect(adapter.category).toBe('email');
    expect(adapter.id).toBe('email-resend');
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('throws on invalid config (zod error from parseResendEmailConfig)', () => {
    expect(() => createResendEmailAdapter({})).toThrow();
  });

  it('exposes a send method', () => {
    const adapter = createResendEmailAdapter({ apiKey: 're_x' });
    expect(typeof adapter.send).toBe('function');
  });
});

describe('createResendEmailAdapter — end-to-end send', () => {
  it('round-trips a send call through the chokepoint', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ id: 'msg-e2e' }),
      ),
    );
    const adapter = createResendEmailAdapter({ apiKey: 're_x' });
    const result = await adapter.send({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 's',
      text: 't',
    });
    expect(result).toEqual({ id: 'msg-e2e', status: 'queued' });
  });

  it('honors a custom endpoint', async () => {
    server.use(
      http.post('http://localhost:9999/emails', () =>
        HttpResponse.json({ id: 'msg-custom' }),
      ),
    );
    const adapter = createResendEmailAdapter({
      apiKey: 're_x',
      endpoint: 'http://localhost:9999',
    });
    const result = await adapter.send({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 's',
    });
    expect(result.id).toBe('msg-custom');
  });
});
