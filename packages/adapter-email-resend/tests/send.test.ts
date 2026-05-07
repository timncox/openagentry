import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { send, shapeResendBody } from '../src/send.js';
import type { ResendEmailConfig } from '../src/config.js';
import type { EmailMessage } from '@openagentry/core';

const cfg: ResendEmailConfig = {
  apiKey: 're_test_key',
  endpoint: 'https://api.resend.com',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('shapeResendBody — field mapping', () => {
  it('maps replyTo → reply_to', () => {
    const body = shapeResendBody({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'hi',
      replyTo: 'e@f.com',
    });
    expect(body).toEqual({ to: 'a@b.com', from: 'c@d.com', subject: 'hi', reply_to: 'e@f.com' });
  });

  it('maps attachments[].contentType → attachments[].content_type', () => {
    const ab = new TextEncoder().encode('hello').buffer;
    const body = shapeResendBody({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'x',
      attachments: [{ filename: 'a.txt', content: ab, contentType: 'text/plain' }],
    });
    expect(body.attachments).toEqual([
      {
        filename: 'a.txt',
        content: Buffer.from('hello').toString('base64'),
        content_type: 'text/plain',
      },
    ]);
  });

  it('omits text/html/reply_to when undefined', () => {
    const body = shapeResendBody({ to: 'a@b.com', from: 'c@d.com', subject: 'x' });
    expect(body).not.toHaveProperty('text');
    expect(body).not.toHaveProperty('html');
    expect(body).not.toHaveProperty('reply_to');
  });

  it('omits attachments when empty array', () => {
    const body = shapeResendBody({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'x',
      attachments: [],
    });
    expect(body).not.toHaveProperty('attachments');
  });

  it('omits attachment.content_type when undefined', () => {
    const body = shapeResendBody({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'x',
      attachments: [{ filename: 'a.txt', content: 'data' }],
    });
    expect(body.attachments?.[0]).not.toHaveProperty('content_type');
  });

  it('passes through array `to` unchanged', () => {
    const body = shapeResendBody({
      to: ['a@b.com', 'c@d.com'],
      from: 'e@f.com',
      subject: 'x',
    });
    expect(body.to).toEqual(['a@b.com', 'c@d.com']);
  });
});

describe('send — happy path', () => {
  it('returns {id, status: "queued"} on 200', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ id: 'msg-abc-123' }, { status: 200 }),
      ),
    );
    const result = await send(cfg, {
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'hi',
      text: 'hello',
    });
    expect(result).toEqual({ id: 'msg-abc-123', status: 'queued' });
  });

  it('sends the body to /emails with field mapping applied', async () => {
    let receivedBody: unknown;
    server.use(
      http.post('https://api.resend.com/emails', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 'm1' });
      }),
    );
    const message: EmailMessage = {
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'subject-line',
      text: 'plaintext',
      html: '<p>html</p>',
      replyTo: 'reply@x.com',
    };
    await send(cfg, message);
    expect(receivedBody).toEqual({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'subject-line',
      text: 'plaintext',
      html: '<p>html</p>',
      reply_to: 'reply@x.com',
    });
  });

  it('sends attachments base64-encoded with content_type snake_case', async () => {
    let receivedBody: any;
    server.use(
      http.post('https://api.resend.com/emails', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 'm2' });
      }),
    );
    const ab = new TextEncoder().encode('binary content').buffer;
    await send(cfg, {
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'x',
      attachments: [
        { filename: 'note.txt', content: 'plain text', contentType: 'text/plain' },
        { filename: 'data.bin', content: ab },
      ],
    });
    expect(receivedBody.attachments).toHaveLength(2);
    expect(receivedBody.attachments[0]).toEqual({
      filename: 'note.txt',
      content: Buffer.from('plain text').toString('base64'),
      content_type: 'text/plain',
    });
    expect(receivedBody.attachments[1]).toEqual({
      filename: 'data.bin',
      content: Buffer.from('binary content').toString('base64'),
    });
  });
});

describe('send — malformed responses', () => {
  it('throws E_RESEND_UPSTREAM when response is not JSON', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        new HttpResponse('not json', { status: 200 }),
      ),
    );
    await expect(
      send(cfg, { to: 'a@b.com', from: 'c@d.com', subject: 'x' }),
    ).rejects.toMatchObject({ code: 'E_RESEND_UPSTREAM' });
  });

  it('throws E_RESEND_UPSTREAM when response lacks an id field', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ noid: true }, { status: 200 }),
      ),
    );
    await expect(
      send(cfg, { to: 'a@b.com', from: 'c@d.com', subject: 'x' }),
    ).rejects.toMatchObject({ code: 'E_RESEND_UPSTREAM' });
  });

  it('throws E_RESEND_UPSTREAM when id is empty string', async () => {
    server.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json({ id: '' }, { status: 200 }),
      ),
    );
    await expect(
      send(cfg, { to: 'a@b.com', from: 'c@d.com', subject: 'x' }),
    ).rejects.toMatchObject({ code: 'E_RESEND_UPSTREAM' });
  });
});
