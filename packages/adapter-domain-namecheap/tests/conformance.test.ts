import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runSuite } from '@openagentry/adapter-test-suite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const packageDir = resolve(dirname(__filename), '..');

/**
 * Default MSW handler: any request to the Namecheap endpoint returns an
 * AUTH error XML envelope. This causes checkAvailability (the structured-errors
 * probe) to throw AgentryError({ code: 'E_NAMECHEAP_AUTH', phase: 'read' }),
 * satisfying the domain/structured-errors check requirement that:
 *   - rejection instanceof AgentryError
 *   - phase is in DOMAIN_PHASES ('init' | 'read' | 'write' | 'transfer')
 *   - code is a string starting with 'E_'
 *
 * Note: checkAvailability('not a domain at all') actually fails the local
 * DOMAIN_RE regex before reaching the network, so this handler is a safety
 * net rather than the primary trigger for the structured-errors check.
 */
const XML_AUTH_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="1011102">API Key is invalid or API access has not been enabled</Error>
  </Errors>
  <CommandResponse Type="namecheap.domains.check"/>
</ApiResponse>`;

const server = setupServer(
  http.get('https://api.namecheap.com/xml.response', () =>
    HttpResponse.text(XML_AUTH_ERROR, { headers: { 'Content-Type': 'text/xml' } }),
  ),
);

beforeAll(() => {
  // Set env vars so the lazy default can construct an adapter.
  // The adapter will reach out to the real endpoint (intercepted by MSW above).
  process.env.OA_NAMECHEAP_API_USER = 'conformance_user';
  process.env.OA_NAMECHEAP_API_KEY = 'conformance_key';
  process.env.OA_NAMECHEAP_CLIENT_IP = '127.0.0.1';
  // Ensure the opt-in dns-roundtrip check does NOT run.
  delete process.env.OA_DOMAIN_CONFORMANCE_TEST_DOMAIN;
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => server.resetHandlers());

afterAll(() => {
  server.close();
  delete process.env.OA_NAMECHEAP_API_USER;
  delete process.env.OA_NAMECHEAP_API_KEY;
  delete process.env.OA_NAMECHEAP_CLIENT_IP;
});

describe('Namecheap domain adapter conformance', () => {
  it('passes universal checks + domain/structured-errors; dns-roundtrip is absent', async () => {
    const result = await runSuite({
      target: packageDir,
      category: 'domain',
    });

    const failures = result.checks.filter((c) => c.status === 'fail');
    if (failures.length > 0) {
      console.error('Conformance failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);

    // Must include all 4 universal checks + domain/structured-errors = at least 5.
    expect(result.checks.length).toBeGreaterThanOrEqual(5);

    const ids = result.checks.map((c) => c.id);

    // Universal checks always present:
    expect(ids).toContain('manifest/valid');
    expect(ids).toContain('manifest/protocol-compatible');
    expect(ids).toContain('ai-friendly/flags');
    expect(ids).toContain('docs/llm-md');

    // Always-on domain functional check:
    expect(ids).toContain('domain/structured-errors');

    // Opt-in check must NOT be present (env var unset):
    expect(ids).not.toContain('domain/dns-roundtrip');
  });
});
