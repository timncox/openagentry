import { describe, it, expect } from 'vitest';
import { createResendEmailAdapter } from '../src/adapter.js';

/**
 * Hits the real Resend API. Skipped unless both env vars are set:
 *   RESEND_API_KEY            — your real Resend API key
 *   EMAIL_INTEGRATION_FROM    — a verified sending address on the account
 *
 * Sends to delivered@resend.dev — Resend's test address that accepts and
 * returns success without actually delivering. No mailbox required.
 *
 * Run with:
 *   RESEND_API_KEY=re_xxx EMAIL_INTEGRATION_FROM='you@yourdomain.com' \
 *     pnpm --filter @openagentry/adapter-email-resend test tests/integration.test.ts
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_INTEGRATION_FROM;
const enabled = typeof RESEND_API_KEY === 'string' && RESEND_API_KEY.length > 0
  && typeof FROM === 'string' && FROM.length > 0;

describe.skipIf(!enabled)('Resend integration (real API)', () => {
  it('sends to delivered@resend.dev and returns a non-empty id', async () => {
    const adapter = createResendEmailAdapter({ apiKey: RESEND_API_KEY! });
    const result = await adapter.send({
      to: 'delivered@resend.dev',
      from: FROM!,
      subject: `oa-integration ${Date.now()}`,
      text: 'oa-integration smoke test',
    });
    expect(result.id).toBeTypeOf('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.status).toBeTypeOf('string');
    expect(result.status.length).toBeGreaterThan(0);
  }, 30_000);
});
