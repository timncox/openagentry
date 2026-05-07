import { describe, it, expect } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import { putOp } from '../../src/ops/put.js';
import type { R2StorageConfig } from '../../src/config.js';
import type { SignedFetch } from '../../src/s3-client.js';

const cfg: R2StorageConfig = {
  accountId: 'a'.repeat(32),
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  bucket: 'b',
  region: 'auto',
  endpoint: 'https://example.test',
  presignTtlSeconds: 3600,
};

const cfgPublic: R2StorageConfig = { ...cfg, publicBaseUrl: 'https://files.example.com' };

function fakeClient(responder: (opts: { method: string; key?: string; headers?: Record<string, string>; body?: BodyInit }) => Response): SignedFetch {
  return {
    async request(opts) {
      return responder(opts);
    },
    async presignGet(key, ttl) {
      return `https://example.test/b/${encodeURIComponent(key)}?X-Amz-Signature=fake&X-Amz-Expires=${ttl}`;
    },
    endpoint: 'https://example.test',
    bucket: 'b',
  };
}

describe('putOp', () => {
  it('uploads a small body and returns a presigned URL by default', async () => {
    let captured: { headers?: Record<string, string>; body?: BodyInit } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    const result = await putOp(client, cfg, 'a.txt', 'hello');
    expect(result.key).toBe('a.txt');
    expect(result.size).toBe(5);
    expect(result.contentType).toBe('text/plain');
    expect(result.url).toContain('X-Amz-Signature=fake');
    expect(captured.headers?.['Content-Type']).toBe('text/plain');
    expect(captured.headers?.['Cache-Control']).toBe('private, no-cache');
  });

  it('with public:true and publicBaseUrl returns a stable URL + sets oa-public meta', async () => {
    let captured: { headers?: Record<string, string> } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    const result = await putOp(client, cfgPublic, 'logo.png', 'PNG-bytes', { public: true });
    expect(result.url).toBe('https://files.example.com/logo.png');
    expect(captured.headers?.['x-amz-meta-oa-public']).toBe('1');
    expect(captured.headers?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(captured.headers?.['Content-Type']).toBe('image/png');
  });

  it('throws E_R2_PUBLIC_NOT_CONFIGURED when public:true but no publicBaseUrl', async () => {
    const client = fakeClient(() => new Response('', { status: 200 }));
    try {
      await putOp(client, cfg, 'a.txt', 'x', { public: true });
      throw new Error('should have thrown');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_R2_PUBLIC_NOT_CONFIGURED');
    }
  });

  it('caller-supplied contentType wins over sniffing', async () => {
    let captured: { headers?: Record<string, string> } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    await putOp(client, cfg, 'a.txt', 'x', { contentType: 'application/x-custom' });
    expect(captured.headers?.['Content-Type']).toBe('application/x-custom');
  });

  it('falls back to application/octet-stream for unknown extensions', async () => {
    let captured: { headers?: Record<string, string> } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    await putOp(client, cfg, 'data.bin', 'x');
    expect(captured.headers?.['Content-Type']).toBe('application/octet-stream');
  });

  it('lowercases custom meta keys', async () => {
    let captured: { headers?: Record<string, string> } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    await putOp(client, cfg, 'a.txt', 'x', { meta: { UserId: '42', traceId: 'abc' } });
    expect(captured.headers?.['x-amz-meta-userid']).toBe('42');
    expect(captured.headers?.['x-amz-meta-traceid']).toBe('abc');
  });

  it('throws E_R2_PERMISSION on 403', async () => {
    const client = fakeClient(() => new Response('forbidden', { status: 403 }));
    try {
      await putOp(client, cfg, 'a.txt', 'x');
      throw new Error('should have thrown');
    } catch (err) {
      expect(isAgentryError(err)).toBe(true);
      expect((err as { code: string }).code).toBe('E_R2_PERMISSION');
    }
  });

  it('throws E_R2_UPSTREAM on 500', async () => {
    const client = fakeClient(() => new Response('boom', { status: 500 }));
    try {
      await putOp(client, cfg, 'a.txt', 'x');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { code: string }).code).toBe('E_R2_UPSTREAM');
    }
  });

  it('wraps fetch rejections as E_R2_NETWORK', async () => {
    const client: SignedFetch = {
      async request() {
        throw new TypeError('fetch failed');
      },
      async presignGet(k) {
        return `https://example.test/${k}`;
      },
      endpoint: 'https://example.test',
      bucket: 'b',
    };
    try {
      await putOp(client, cfg, 'a.txt', 'x');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { code: string }).code).toBe('E_R2_NETWORK');
    }
  });

  it('measures size for ArrayBuffer body', async () => {
    const client = fakeClient(() => new Response('', { status: 200 }));
    const buf = new ArrayBuffer(42);
    const result = await putOp(client, cfg, 'a.bin', buf);
    expect(result.size).toBe(42);
  });

  it('measures size for Uint8Array body', async () => {
    const client = fakeClient(() => new Response('', { status: 200 }));
    const u8 = new Uint8Array(7);
    const result = await putOp(client, cfg, 'a.bin', u8);
    expect(result.size).toBe(7);
  });

  it('does not let custom meta override the internal oa-public marker', async () => {
    let captured: { headers?: Record<string, string> } = {};
    const client = fakeClient((opts) => {
      captured = opts;
      return new Response('', { status: 200 });
    });
    await putOp(client, cfgPublic, 'logo.png', 'x', {
      public: true,
      meta: { 'oa-public': '0', 'OA-Public': 'no' },  // case-insensitive collision attempt
    });
    expect(captured.headers?.['x-amz-meta-oa-public']).toBe('1');
  });
});
