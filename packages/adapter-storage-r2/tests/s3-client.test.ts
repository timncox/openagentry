import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createS3Client } from '../src/s3-client.js';
import type { R2StorageConfig } from '../src/config.js';

const cfg: R2StorageConfig = {
  accountId: 'a'.repeat(32),
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  bucket: 'b',
  region: 'auto',
  endpoint: 'https://example.test',
  presignTtlSeconds: 3600,
};

describe('createS3Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes endpoint + bucket', () => {
    const c = createS3Client(cfg);
    expect(c.endpoint).toBe('https://example.test');
    expect(c.bucket).toBe('b');
  });

  it('PUT request signs and includes path-style /<bucket>/<key>', async () => {
    let captured: Request | undefined;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      captured = req;
      return new Response('', { status: 200 });
    }));
    const c = createS3Client(cfg);
    await c.request({ method: 'PUT', key: 'hello world.txt', body: 'x' });
    expect(captured).toBeDefined();
    expect(captured!.url).toBe('https://example.test/b/hello%20world.txt');
    expect(captured!.method).toBe('PUT');
    expect(captured!.headers.get('x-amz-date')).toBeTruthy();
    expect(captured!.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it('GET request includes query params for list', async () => {
    let captured: Request | undefined;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      captured = req;
      return new Response('', { status: 200 });
    }));
    const c = createS3Client(cfg);
    await c.request({ method: 'GET', query: { 'list-type': '2', prefix: 'pfx/' } });
    expect(captured).toBeDefined();
    const url = new URL(captured!.url);
    expect(url.pathname).toBe('/b');
    expect(url.searchParams.get('list-type')).toBe('2');
    expect(url.searchParams.get('prefix')).toBe('pfx/');
  });

  it('presignGet returns a URL with required SigV4 query params', async () => {
    const c = createS3Client(cfg);
    const url = await c.presignGet('foo/bar.txt', 300);
    const u = new URL(url);
    expect(u.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(u.searchParams.get('X-Amz-Credential')).toContain('AKIA');
    expect(u.searchParams.get('X-Amz-Date')).toBeTruthy();
    expect(u.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(u.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(u.pathname).toBe('/b/foo/bar.txt');
  });

  it('encodes unicode keys in the URL', async () => {
    let captured: Request | undefined;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      captured = req;
      return new Response('', { status: 200 });
    }));
    const c = createS3Client(cfg);
    await c.request({ method: 'HEAD', key: '名前.txt' });
    expect(captured!.url).toContain('%E5%90%8D%E5%89%8D');
  });
});
