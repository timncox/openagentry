import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuite } from '../../src/runner.js';
import '../../src/suites/auth.js'; // side-effect: registers the auth functional suite

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const goodAuth = join(__dirname, '..', 'fixtures', 'good-auth');
const badAuth = join(__dirname, '..', 'fixtures', 'bad-auth');

describe('authSuite (skeleton)', () => {
  it('fails the auth/listProviders bootstrap check when module category is wrong', async () => {
    const r = await runSuite({ target: badAuth });
    const failure = r.checks.find((c) => c.id === 'auth/listProviders');
    expect(failure?.status).toBe('fail');
    expect(failure?.message).toMatch(/category/i);
  });
});

const badAuthFunctional = join(__dirname, '..', 'fixtures', 'bad-auth-functional');

describe('authSuite (functional checks)', () => {
  it('total == 4 universal + 5 functional == 9, all pass for good-auth', async () => {
    const r = await runSuite({ target: goodAuth });
    expect(r.total).toBe(9);
    expect(r.passed).toBe(9);
  });

  it('passes all five auth checks against good-auth fixture', async () => {
    const r = await runSuite({ target: goodAuth });
    const authChecks = r.checks.filter((c) => c.id.startsWith('auth/'));
    expect(authChecks).toHaveLength(5);
    for (const check of authChecks) {
      expect(check.status).toBe('pass');
    }
  });

  it('fails listProviders, rejects-invalid, rejects-expired, and structured-errors on bad-auth-functional', async () => {
    const r = await runSuite({ target: badAuthFunctional });
    const byId = Object.fromEntries(
      r.checks.filter((c) => c.id.startsWith('auth/')).map((c) => [c.id, c.status]),
    );
    expect(byId['auth/listProviders']).toBe('fail');
    // verifySession-roundtrip also fails because the fixture returns
    // userId 'fake-user' and the suite asserts strict equality with 'conformance-user-1'.
    expect(byId['auth/verifySession-roundtrip']).toBe('fail');
    expect(byId['auth/verifySession-rejects-invalid']).toBe('fail');
    expect(byId['auth/verifySession-rejects-expired']).toBe('fail');
    expect(byId['auth/structured-errors']).toBe('fail');
  });
});
