import { describe, it, expect } from 'vitest';
import { listOp } from '../../src/ops/list.js';
import type { R2StorageConfig } from '../../src/config.js';
import type { SignedFetch, S3RequestOpts } from '../../src/s3-client.js';

const cfg: R2StorageConfig = {
  accountId: 'a'.repeat(32),
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  bucket: 'b',
  region: 'auto',
  endpoint: 'https://example.test',
  presignTtlSeconds: 3600,
};

function pageXml(contents: Array<{ key: string; size: number }>, truncated: boolean, nextToken?: string): string {
  return `<ListBucketResult>${truncated ? `<IsTruncated>true</IsTruncated><NextContinuationToken>${nextToken}</NextContinuationToken>` : '<IsTruncated>false</IsTruncated>'}${contents.map((c) => `<Contents><Key>${c.key}</Key><Size>${c.size}</Size><LastModified>2026-05-01T12:00:00.000Z</LastModified></Contents>`).join('')}</ListBucketResult>`;
}

function clientWithPages(pages: Array<{ contents: Array<{ key: string; size: number }>; truncated: boolean; nextToken?: string }>): { client: SignedFetch; calls: S3RequestOpts[] } {
  const calls: S3RequestOpts[] = [];
  let i = 0;
  const client: SignedFetch = {
    async request(opts) {
      calls.push(opts);
      const p = pages[i++]!;
      return new Response(pageXml(p.contents, p.truncated, p.nextToken), { status: 200 });
    },
    async presignGet(k) {
      return `https://example.test/b/${k}?X-Amz-Signature=fake`;
    },
    endpoint: 'https://example.test',
    bucket: 'b',
  };
  return { client, calls };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('listOp', () => {
  it('yields a single page', async () => {
    const { client } = clientWithPages([{ contents: [{ key: 'a', size: 1 }, { key: 'b', size: 2 }], truncated: false }]);
    const out = await collect(listOp(client, cfg));
    expect(out).toHaveLength(2);
    expect(out[0]?.key).toBe('a');
    expect(out[0]?.url).toContain('X-Amz-Signature=fake');
  });

  it('paginates with continuation token', async () => {
    const { client, calls } = clientWithPages([
      { contents: [{ key: 'a', size: 1 }], truncated: true, nextToken: 'tok-2' },
      { contents: [{ key: 'b', size: 2 }], truncated: false },
    ]);
    const out = await collect(listOp(client, cfg));
    expect(out.map((o) => o.key)).toEqual(['a', 'b']);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.query?.['continuation-token']).toBe('tok-2');
  });

  it('passes prefix to the request', async () => {
    const { client, calls } = clientWithPages([{ contents: [], truncated: false }]);
    const out = await collect(listOp(client, cfg, 'pfx/'));
    expect(out).toEqual([]);
    expect(calls[0]?.query?.prefix).toBe('pfx/');
    expect(calls[0]?.query?.['list-type']).toBe('2');
  });

  it('omits prefix when not provided', async () => {
    const { client, calls } = clientWithPages([{ contents: [], truncated: false }]);
    await collect(listOp(client, cfg));
    expect(calls[0]?.query?.prefix).toBeUndefined();
  });

  it('throws E_R2_PERMISSION on 403', async () => {
    const client: SignedFetch = {
      async request() {
        return new Response('', { status: 403 });
      },
      async presignGet(k) {
        return k;
      },
      endpoint: '',
      bucket: '',
    };
    await expect(collect(listOp(client, cfg))).rejects.toMatchObject({ code: 'E_R2_PERMISSION' });
  });

  it('throws E_R2_UPSTREAM on malformed XML', async () => {
    const client: SignedFetch = {
      async request() {
        return new Response('not xml at all', { status: 200 });
      },
      async presignGet(k) {
        return k;
      },
      endpoint: '',
      bucket: '',
    };
    await expect(collect(listOp(client, cfg))).rejects.toMatchObject({ code: 'E_R2_UPSTREAM' });
  });
});
