import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getStore, PUBLIC_HOST, resetStore, TOKEN } from './conformance/mock-store.js';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

vi.mock('@vercel/blob', async () => {
  const { makeSdkMock } = await import('./conformance/sdk-mock.js');
  return makeSdkMock();
});

const server = setupServer(
  // Public-host fetch: return the stored body for public blobs.
  http.get(`https://${PUBLIC_HOST}/:pathname*`, ({ params }) => {
    const pathnameParam = params['pathname'];
    const pathname = Array.isArray(pathnameParam)
      ? pathnameParam.join('/')
      : (pathnameParam ?? '');
    const stored = getStore().get(pathname);
    if (stored === undefined || stored.access !== 'public') {
      return HttpResponse.text('not found', { status: 404 });
    }
    return new HttpResponse(stored.body, {
      status: 200,
      headers: { 'content-type': stored.contentType },
    });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  process.env.OA_VERCEL_BLOB_TOKEN = TOKEN;
  process.env.OA_VERCEL_BLOB_DEFAULT_ACCESS = 'public';
});

beforeEach(() => {
  resetStore();
});

afterAll(() => {
  server.close();
  delete process.env.OA_VERCEL_BLOB_TOKEN;
  delete process.env.OA_VERCEL_BLOB_DEFAULT_ACCESS;
});

describe('conformance — adapter-test-suite storage', () => {
  it('passes universal + storage functional + public-url-roundtrip', async () => {
    const result = await runSuite({
      category: 'storage',
      target: packageDir,
    });
    const failures = result.checks.filter((r) => r.status === 'fail');
    if (failures.length > 0) {
      console.error(failures.map((f) => `${f.id}: ${f.message ?? '<no message>'}`).join('\n'));
    }
    expect(failures).toEqual([]);
    expect(result.checks.length).toBeGreaterThanOrEqual(8);
    const ids = result.checks.map((r) => r.id);
    expect(ids).toContain('storage/public-url-roundtrip');
  }, 30_000);
});
