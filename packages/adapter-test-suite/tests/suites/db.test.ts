import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/db.js'; // side-effect: registers the db functional suite

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodDb = join(__dirname, '..', 'fixtures', 'good-db');
const badDb = join(__dirname, '..', 'fixtures', 'bad-db');

describe('dbSuite (skeleton)', () => {
  it('emits zero db checks when the adapter is correctly categorised', async () => {
    const r = await runSuite({ target: goodDb });
    const dbChecks = r.checks.filter((c) => c.id.startsWith('db/'));
    expect(dbChecks).toEqual([]);
  });

  it('fails the db/createInstance bootstrap check when module category is wrong', async () => {
    const r = await runSuite({ target: badDb });
    const failure = r.checks.find((c) => c.id === 'db/createInstance');
    expect(failure?.status).toBe('fail');
    expect(failure?.message).toMatch(/category/i);
  });
});
