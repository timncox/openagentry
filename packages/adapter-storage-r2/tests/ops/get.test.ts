import { describe, it, expect } from 'vitest';
import { getOp } from '../../src/ops/get.js';
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
  publicBaseUrl: 'https://files.example.com',
};

function fakeClient(response: Response): SignedFetch {
  return {
    async request() {
      return response;
    },
    async presignGet(key) {
      return `https://example.test/b/${key}?X-Amz-Signature=fake`;
    },
    endpoint: 'https://example.test',
    bucket: 'b',
  };
}

describe('getOp', () => {
  it('returns StorageObject for 200 with private flag (presigned URL)', async () => {
    const client = fakeClient(
      new Response(null, {
        status: 200,
        headers: {
          'content-length': '128',
          'content-type': 'image/png',
          'last-modified': 'Wed, 01 May 2026 12:00:00 GMT',
        },
      }),
    );
    const result = await getOp(client, cfg, 'logo.png');
    expect(result?.size).toBe(128);
    expect(result?.contentType).toBe('image/png');
    expect(result?.url).toContain('X-Amz-Signature=fake');
    expect(result?.uploadedAt).toBe('2026-05-01T12:00:00.000Z');
  });

  it('returns StorageObject with stable public URL when oa-public meta is set', async () => {
    const client = fakeClient(
      new Response(null, {
        status: 200,
        headers: {
          'content-length': '99',
          'content-type': 'image/jpeg',
          'last-modified': 'Wed, 01 May 2026 12:00:00 GMT',
          'x-amz-meta-oa-public': '1',
        },
      }),
    );
    const result = await getOp(client, cfg, 'photo.jpg');
    expect(result?.url).toBe('https://files.example.com/photo.jpg');
  });

  it('returns null on 404', async () => {
    const client = fakeClient(new Response('', { status: 404 }));
    const result = await getOp(client, cfg, 'missing.txt');
    expect(result).toBeNull();
  });

  it('throws E_R2_PERMISSION on 403', async () => {
    const client = fakeClient(new Response('', { status: 403 }));
    await expect(getOp(client, cfg, 'a.txt')).rejects.toMatchObject({ code: 'E_R2_PERMISSION' });
  });

  it('throws E_R2_INVALID_KEY for empty key (does not call request)', async () => {
    let called = false;
    const client: SignedFetch = {
      async request() {
        called = true;
        return new Response('', { status: 200 });
      },
      async presignGet(k) {
        return k;
      },
      endpoint: '',
      bucket: '',
    };
    await expect(getOp(client, cfg, '')).rejects.toMatchObject({ code: 'E_R2_INVALID_KEY' });
    expect(called).toBe(false);
  });

  it('falls back to current time when last-modified is missing', async () => {
    const client = fakeClient(new Response(null, { status: 200, headers: { 'content-length': '0' } }));
    const result = await getOp(client, cfg, 'a.txt');
    expect(result?.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles missing publicBaseUrl gracefully — falls back to presigned even when oa-public set', async () => {
    const cfgNoPublic: R2StorageConfig = { ...cfg };
    delete (cfgNoPublic as { publicBaseUrl?: string }).publicBaseUrl;
    const client = fakeClient(
      new Response(null, {
        status: 200,
        headers: { 'content-length': '0', 'x-amz-meta-oa-public': '1' },
      }),
    );
    const result = await getOp(client, cfgNoPublic, 'a.txt');
    expect(result?.url).toContain('X-Amz-Signature=fake');
  });
});
