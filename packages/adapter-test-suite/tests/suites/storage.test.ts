import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/storage.js'; // side-effect: registers the storage suite

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodStorage = join(__dirname, '..', 'fixtures', 'good-storage');
const badStorage = join(__dirname, '..', 'fixtures', 'bad-storage');

describe('storage functional suite — good-storage', () => {
  it('runs all 3 functional checks and they all pass', async () => {
    const r = await runSuite({ target: goodStorage });
    const fn = r.checks.filter((c) => c.id.startsWith('storage/'));
    expect(fn.map((c) => c.id).sort()).toEqual([
      'storage/list-prefix',
      'storage/put-get-delete',
      'storage/structured-errors',
    ]);
    expect(fn.every((c) => c.status === 'pass')).toBe(true);
  });

  it('total is 4 universal + 3 functional = 7', async () => {
    const r = await runSuite({ target: goodStorage });
    expect(r.total).toBe(7);
    expect(r.passed).toBe(7);
  });
});

describe('storage functional suite — bad-storage', () => {
  it('storage/structured-errors fails (bad-storage throws plain Error)', async () => {
    const r = await runSuite({ target: badStorage });
    const c = r.checks.find((x) => x.id === 'storage/structured-errors');
    expect(c?.status).toBe('fail');
  });

  it('ai-friendly/flags also fails (bad-storage manifest has structuredErrors:false)', async () => {
    const r = await runSuite({ target: badStorage });
    const c = r.checks.find((x) => x.id === 'ai-friendly/flags');
    expect(c?.status).toBe('fail');
  });
});
