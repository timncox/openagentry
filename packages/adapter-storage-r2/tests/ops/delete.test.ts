import { describe, it, expect } from 'vitest';
import { deleteOp } from '../../src/ops/delete.js';
import type { SignedFetch } from '../../src/s3-client.js';

function fakeClient(response: Response): SignedFetch {
  return {
    async request() {
      return response;
    },
    async presignGet(k) {
      return k;
    },
    endpoint: '',
    bucket: '',
  };
}

describe('deleteOp', () => {
  it('resolves on 204', async () => {
    const client = fakeClient(new Response(null, { status: 204 }));
    await expect(deleteOp(client, 'a.txt')).resolves.toBeUndefined();
  });

  it('resolves on 200', async () => {
    const client = fakeClient(new Response('', { status: 200 }));
    await expect(deleteOp(client, 'a.txt')).resolves.toBeUndefined();
  });

  it('resolves silently on 404 (idempotent)', async () => {
    const client = fakeClient(new Response('', { status: 404 }));
    await expect(deleteOp(client, 'a.txt')).resolves.toBeUndefined();
  });

  it('throws E_R2_PERMISSION on 403', async () => {
    const client = fakeClient(new Response('', { status: 403 }));
    await expect(deleteOp(client, 'a.txt')).rejects.toMatchObject({ code: 'E_R2_PERMISSION' });
  });

  it('throws E_R2_UPSTREAM on 500', async () => {
    const client = fakeClient(new Response('boom', { status: 500 }));
    await expect(deleteOp(client, 'a.txt')).rejects.toMatchObject({ code: 'E_R2_UPSTREAM' });
  });

  it('throws E_R2_INVALID_KEY for empty key', async () => {
    const client = fakeClient(new Response(null, { status: 204 }));
    await expect(deleteOp(client, '')).rejects.toMatchObject({ code: 'E_R2_INVALID_KEY' });
  });

  it('wraps fetch rejections as E_R2_NETWORK', async () => {
    const client: SignedFetch = {
      async request() {
        throw new Error('ECONNREFUSED');
      },
      async presignGet(k) {
        return k;
      },
      endpoint: '',
      bucket: '',
    };
    await expect(deleteOp(client, 'a.txt')).rejects.toMatchObject({ code: 'E_R2_NETWORK' });
  });
});
