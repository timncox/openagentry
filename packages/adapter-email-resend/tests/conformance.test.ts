import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

const server = setupServer(
  // Default handler: any POST to /emails returns 422 (so the structured-errors probe throws E_RESEND_INVALID).
  http.post('https://api.resend.com/emails', () =>
    HttpResponse.json({ name: 'invalid_parameter' }, { status: 422 }),
  ),
);

beforeAll(() => {
  process.env.OA_RESEND_API_KEY = 're_conformance_test';
  // Ensure opt-in functional check is NOT triggered.
  delete process.env.EMAIL_CONFORMANCE_TEST_TO;
  delete process.env.EMAIL_CONFORMANCE_TEST_FROM;
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  delete process.env.OA_RESEND_API_KEY;
});

describe('Resend email adapter conformance', () => {
  it('passes universal + email/structured-errors checks', async () => {
    const result = await runSuite({
      target: packageDir,
      category: 'email',
    });
    const failures = result.checks.filter((c) => c.status === 'fail');
    if (failures.length > 0) {
      console.error('Conformance failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
    // Expected: 4 universal + 1 structured-errors = 5. send-returns-id-shape is opt-in and should be absent.
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
    const ids = result.checks.map((c) => c.id);
    expect(ids).toContain('email/structured-errors');
    expect(ids).not.toContain('email/send-returns-id-shape');
  });
});
