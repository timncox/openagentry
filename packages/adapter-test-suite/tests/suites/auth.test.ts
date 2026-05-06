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

  it('emits zero auth checks for good-auth fixture before functional checks land', async () => {
    const r = await runSuite({ target: goodAuth });
    const authChecks = r.checks.filter((c) => c.id.startsWith('auth/'));
    expect(authChecks).toEqual([]);
  });
});
