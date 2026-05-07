import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { initiateTransfer } from '../src/transfer.js';
import type { NamecheapDomainConfig } from '../src/config.js';
import { NAMECHEAP_ERROR_CODES } from '../src/errors.js';

const cfg: NamecheapDomainConfig = {
  apiUser: 'testuser',
  apiKey: 'testkey',
  clientIp: '1.2.3.4',
  userName: 'testuser',
  endpoint: 'http://localhost:9102/xml.response',
  useSandbox: false,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function transferXml(status: string, transferId = 'TRF-12345'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.transfer.create">
    <DomainTransferCreateResult Domain="example.com" TransferID="${transferId}"
      StatusID="10" Status="${status}" OrderID="98765" TransactionID="44321" />
  </CommandResponse>
</ApiResponse>`;
}

function namecheapHandler(xml: string) {
  return http.get('http://localhost:9102/xml.response', () =>
    new HttpResponse(xml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    }),
  );
}

describe('initiateTransfer — pending status', () => {
  it('maps Namecheap status "Pending" → "pending"', async () => {
    server.use(namecheapHandler(transferXml('Pending')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('pending');
    expect(result.domain).toBe('example.com');
    expect(result.transferId).toBe('TRF-12345');
    expect(result.authCode).toBe('EPP-CODE-123');
  });

  it('maps Namecheap status "Inprogress" → "pending"', async () => {
    server.use(namecheapHandler(transferXml('Inprogress')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('pending');
  });
});

describe('initiateTransfer — confirmed status', () => {
  it('maps Namecheap status "Success" → "confirmed"', async () => {
    server.use(namecheapHandler(transferXml('Success')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('confirmed');
  });
});

describe('initiateTransfer — failed status', () => {
  it('maps Namecheap status "Failed" → "failed"', async () => {
    server.use(namecheapHandler(transferXml('Failed')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('failed');
  });
});

describe('initiateTransfer — unknown status', () => {
  it('defaults unknown status to "pending" (conservative)', async () => {
    server.use(namecheapHandler(transferXml('Reviewing')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('pending');
  });

  it('defaults empty status string to "pending"', async () => {
    server.use(namecheapHandler(transferXml('')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-123');
    expect(result.status).toBe('pending');
  });
});

describe('initiateTransfer — transferId in response', () => {
  it('round-trips the TransferID from the response', async () => {
    server.use(namecheapHandler(transferXml('Pending', 'TRF-UNIQUE-999')));
    const result = await initiateTransfer(cfg, 'example.com', 'EPP-CODE-XYZ');
    expect(result.transferId).toBe('TRF-UNIQUE-999');
  });

  it('round-trips the authCode from the input (Namecheap does not echo it)', async () => {
    server.use(namecheapHandler(transferXml('Pending')));
    const result = await initiateTransfer(cfg, 'example.com', 'MY-SECRET-EPP');
    expect(result.authCode).toBe('MY-SECRET-EPP');
  });
});

describe('initiateTransfer — network failure', () => {
  it('propagates E_NAMECHEAP_NETWORK when fetch throws', async () => {
    server.use(
      http.get('http://localhost:9102/xml.response', () => HttpResponse.error()),
    );
    await expect(
      initiateTransfer(cfg, 'example.com', 'EPP-CODE-123'),
    ).rejects.toMatchObject({
      code: NAMECHEAP_ERROR_CODES.NETWORK,
    });
  });
});
