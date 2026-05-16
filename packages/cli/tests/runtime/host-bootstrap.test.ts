import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resetRegistryForTesting, useAdapter } from '@openagentry/core';
import { _resetForTesting } from '../../src/runtime/host-bootstrap.js';

beforeEach(() => {
  resetRegistryForTesting();
  // Reset bootstrap's `registered` flag.
  _resetForTesting();
});
afterEach(() => {
  resetRegistryForTesting();
});

describe('ensureHostAdapter', () => {
  it('is a no-op when no host env vars are set', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({});
    expect(() => useAdapter('host')).toThrow(/E_NO_ADAPTER_FOR_CATEGORY/);
  });

  it('registers vercel adapter when OA_VERCEL_TOKEN is set', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test' });
    const adapter = useAdapter<{ id: string; category: string }>('host');
    expect(adapter.id).toBe('host-vercel');
  });

  it('honors OA_HOST=cloudflare when both providers configured', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({
      OA_HOST: 'cloudflare',
      OA_VERCEL_TOKEN: 'tok_test',
      OA_CLOUDFLARE_API_TOKEN: 'cf_tok',
      OA_CLOUDFLARE_ACCOUNT_ID: 'acct_test',
    });
    const adapter = useAdapter<{ id: string; category: string }>('host');
    expect(adapter.id).toBe('host-cloudflare');
  });

  it('is idempotent — second call does not re-register', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test' });
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test_changed' });
    const adapter = useAdapter<{ id: string; category: string }>('host');
    expect(adapter.id).toBe('host-vercel');
  });
});
