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
  it('fails the db/createInstance bootstrap check when module category is wrong', async () => {
    const r = await runSuite({ target: badDb });
    const failure = r.checks.find((c) => c.id === 'db/createInstance');
    expect(failure?.status).toBe('fail');
    expect(failure?.message).toMatch(/category/i);
  });
});

const badDbFunctional = join(__dirname, '..', 'fixtures', 'bad-db-functional');

describe('dbSuite (functional checks)', () => {
  it('total == 4 universal + 5 functional == 9, all pass', async () => {
    const r = await runSuite({ target: goodDb });
    expect(r.total).toBe(9);
    expect(r.passed).toBe(9);
  });

  it('passes all five checks against good-db fixture', async () => {
    const r = await runSuite({ target: goodDb });
    const dbChecks = r.checks.filter((c) => c.id.startsWith('db/'));
    expect(dbChecks).toHaveLength(5);
    for (const check of dbChecks) {
      expect(check.status).toBe('pass');
    }
  });

  it('fails idempotency, connectionString, structured-errors, and round-trip on bad-db-functional', async () => {
    const r = await runSuite({ target: badDbFunctional });
    const byId = Object.fromEntries(
      r.checks.filter((c) => c.id.startsWith('db/')).map((c) => [c.id, c.status]),
    );
    expect(byId['db/createInstance']).toBe('pass');
    expect(byId['db/createInstance-idempotent']).toBe('fail');
    expect(byId['db/connectionString']).toBe('fail');
    expect(byId['db/exportState-importState']).toBe('fail');
    expect(byId['db/structured-errors']).toBe('fail');
  });
});
