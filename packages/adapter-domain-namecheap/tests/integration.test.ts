import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createNamecheapDomainAdapter } from '../src/adapter.js';

/**
 * Integration tests against the Namecheap sandbox API.
 *
 * Required env vars (all three must be set for any test to run):
 *   OA_NAMECHEAP_SANDBOX_API_USER   — sandbox API user
 *   OA_NAMECHEAP_SANDBOX_API_KEY    — sandbox API key
 *   OA_NAMECHEAP_SANDBOX_CLIENT_IP  — IP whitelisted in the sandbox account
 *
 * Optional:
 *   OA_NAMECHEAP_SANDBOX_TEST_DOMAIN — a domain already in the sandbox account;
 *                                       enables the listRecords test
 *
 * Run with:
 *   OA_NAMECHEAP_SANDBOX_API_USER=xxx \
 *   OA_NAMECHEAP_SANDBOX_API_KEY=yyy \
 *   OA_NAMECHEAP_SANDBOX_CLIENT_IP=zzz \
 *     pnpm --filter @openagentry/adapter-domain-namecheap test tests/integration.test.ts
 *
 * Destructive ops (purchase, setRecord, deleteRecord, initiateTransfer) are NOT
 * exercised here — they are covered by MSW unit tests only at this layer. The
 * conformance suite's opt-in domain/dns-roundtrip check exercises setRecord /
 * deleteRecord against any backend the runner configures.
 */

const SANDBOX_API_USER = process.env.OA_NAMECHEAP_SANDBOX_API_USER;
const SANDBOX_API_KEY = process.env.OA_NAMECHEAP_SANDBOX_API_KEY;
const SANDBOX_CLIENT_IP = process.env.OA_NAMECHEAP_SANDBOX_CLIENT_IP;
const SANDBOX_TEST_DOMAIN = process.env.OA_NAMECHEAP_SANDBOX_TEST_DOMAIN;

const allRequired =
  typeof SANDBOX_API_USER === 'string' && SANDBOX_API_USER.length > 0 &&
  typeof SANDBOX_API_KEY === 'string' && SANDBOX_API_KEY.length > 0 &&
  typeof SANDBOX_CLIENT_IP === 'string' && SANDBOX_CLIENT_IP.length > 0;

function makeSandboxAdapter() {
  return createNamecheapDomainAdapter({
    apiUser: SANDBOX_API_USER!,
    apiKey: SANDBOX_API_KEY!,
    clientIp: SANDBOX_CLIENT_IP!,
    useSandbox: true,
  });
}

describe.skipIf(!allRequired)('Namecheap sandbox integration (read-only)', () => {
  it('checkAvailability returns correct shape for a unique random domain', async () => {
    const adapter = makeSandboxAdapter();
    const domain = `example-oa-${randomUUID().slice(0, 8)}.com`;
    const result = await adapter.checkAvailability(domain);
    // Shape check — availability value may vary by sandbox account state
    expect(typeof result.available).toBe('boolean');
    expect(result.domain).toBe(domain);
    // priceUsd only present for premium domains; omit assertion for ordinary .com
  }, 30_000);

  it('checkAvailability returns available === false for google.com', async () => {
    const adapter = makeSandboxAdapter();
    const result = await adapter.checkAvailability('google.com');
    expect(result.domain).toBe('google.com');
    // google.com is registered everywhere — sandbox should reflect this
    expect(result.available).toBe(false);
  }, 30_000);

  it.skipIf(!SANDBOX_TEST_DOMAIN)(
    'listRecords returns an array for a sandbox-owned domain',
    async () => {
      const adapter = makeSandboxAdapter();
      const records = await adapter.listRecords(SANDBOX_TEST_DOMAIN!);
      expect(Array.isArray(records)).toBe(true);
      // Each record must have the expected shape
      for (const record of records) {
        expect(typeof record.name).toBe('string');
        expect(typeof record.type).toBe('string');
        expect(typeof record.value).toBe('string');
      }
    },
    30_000,
  );
});
