import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startMinio, type MinioFixture } from './helpers/minio.js';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

let fixture: MinioFixture | undefined;

beforeAll(async () => {
  fixture = await startMinio('oa-r2-conformance');

  process.env.OA_R2_ACCOUNT_ID = '0'.repeat(32);
  process.env.OA_R2_ACCESS_KEY_ID = fixture.accessKey;
  process.env.OA_R2_SECRET_ACCESS_KEY = fixture.secretKey;
  process.env.OA_R2_BUCKET = fixture.bucket;
  process.env.OA_R2_ENDPOINT = fixture.endpoint;
  process.env.OA_R2_PUBLIC_BASE_URL = fixture.publicBaseUrl;
  process.env.OA_R2_PRESIGN_TTL = '300';
}, 90_000);

afterAll(async () => {
  if (fixture !== undefined) await fixture.container.stop();
});

describe('R2 storage adapter conformance', () => {
  it('passes universal + storage functional checks against MinIO', async () => {
    const result = await runSuite({
      target: packageDir,
      category: 'storage',
    });
    const failures = result.checks.filter((c) => c.status === 'fail');
    if (failures.length > 0) {
      console.error('Conformance failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
    // Expected: 4 universal + 3 storage functional + 1 public-url-roundtrip = 8.
    expect(result.checks.length).toBeGreaterThanOrEqual(8);
  }, 60_000);
});
