import { describe, it, expect } from 'vitest';
import { createVercelBlobStorageAdapter } from '../src/index.js';

const TOKEN = process.env.OA_VERCEL_BLOB_TOKEN;
const HAS_REAL_TOKEN =
  typeof TOKEN === 'string' &&
  TOKEN.length > 0 &&
  !TOKEN.startsWith('vercel_blob_rw_DUMMY_') &&
  TOKEN !== 'vercel_blob_rw_TEST'; // conformance test sentinel

describe.skipIf(!HAS_REAL_TOKEN)('integration: real Vercel Blob round-trip', () => {
  it('puts, heads, lists, and deletes a public blob', async () => {
    const adapter = createVercelBlobStorageAdapter({
      token: TOKEN!,
      defaultAccess: 'public',
    });
    const key = `oa-integration/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.txt`;
    const body = `hello ${Date.now()}`;

    const put = await adapter.put(key, body, { public: true });
    expect(put.url).toMatch(/\.public\.blob\.vercel-storage\.com\//);
    expect(put.size).toBe(new TextEncoder().encode(body).length);

    // Public URL should be unauthenticated-fetchable.
    const fetched = await fetch(put.url);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe(body);

    const head = await adapter.get(key);
    expect(head?.size).toBe(new TextEncoder().encode(body).length);

    let found = false;
    for await (const blob of adapter.list('oa-integration/')) {
      if (blob.key === key) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);

    await adapter.delete(key);

    // After delete, head should return null.
    const headAfter = await adapter.get(key);
    expect(headAfter).toBeNull();
  }, 60_000);

  it('puts and deletes a private blob', async () => {
    const adapter = createVercelBlobStorageAdapter({
      token: TOKEN!,
      defaultAccess: 'private',
    });
    const key = `oa-integration/private-${Date.now()}.txt`;
    const put = await adapter.put(key, 'private body');
    expect(put.url).toMatch(/\.private\.blob\.vercel-storage\.com\//);
    await adapter.delete(key);
  }, 30_000);
});
