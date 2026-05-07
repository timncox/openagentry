/**
 * @openagentry/adapter-domain-namecheap — public exports + lazy default export
 * resolved from OA_NAMECHEAP_* env vars.
 *
 * @module
 */

import type {
  DomainAdapter,
  DomainAvailability,
  Domain,
  DnsRecord,
  DomainTransfer,
} from '@openagentry/core';
import { createNamecheapDomainAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { namecheapError, NAMECHEAP_ERROR_CODES, ADAPTER_ID } from './errors.js';

// ─── Public exports ───────────────────────────────────────────────────────────

export { createNamecheapDomainAdapter } from './adapter.js';
export {
  parseNamecheapDomainConfig,
  namecheapDomainConfigSchema,
  type NamecheapDomainConfig,
  type NamecheapDomainConfigInput,
  type NamecheapDomainConfigParsed,
} from './config.js';
export {
  ADAPTER_ID,
  NAMECHEAP_ERROR_CODES,
  type NamecheapErrorCode,
} from './errors.js';

// ─── Lazy default ─────────────────────────────────────────────────────────────

let cached: DomainAdapter | undefined;

/**
 * Construct a NamecheapDomainAdapter from OA_NAMECHEAP_* env vars and cache it.
 * Throws a synchronous AgentryError when required core vars are missing or invalid.
 * This is intentional — the lazy wrapper below catches the sync throw and converts
 * it to Promise.reject so the async contract is preserved (Plan K bug #2).
 */
function buildFromEnv(): DomainAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (!result.ok) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.AUTH,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      context: { missing: result.missing },
      suggestedFix:
        `Set ${result.missing.join(', ')} in your environment before using the default adapter, ` +
        `or call createNamecheapDomainAdapter(config) directly. ` +
        `See https://www.namecheap.com/support/api/intro/ for API access.`,
    });
  }
  cached = createNamecheapDomainAdapter(result.config);
  return cached;
}

/**
 * Lazy default DomainAdapter. Each method builds or reuses the underlying adapter
 * from env vars on first call. Sync throws from buildFromEnv() are caught and
 * converted to Promise.reject so the async contract is always honoured.
 *
 * `category` and `id` are static — they never trigger env init.
 */
const lazyAdapter: DomainAdapter = Object.freeze({
  category: 'domain' as const,
  id: ADAPTER_ID,

  checkAvailability(domain: string): Promise<DomainAvailability> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.checkAvailability(domain);
  },

  purchase(domain: string, years?: number): Promise<Domain> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.purchase(domain, years);
  },

  listRecords(domain: string): Promise<DnsRecord[]> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.listRecords(domain);
  },

  setRecord(domain: string, record: DnsRecord): Promise<DnsRecord> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.setRecord(domain, record);
  },

  deleteRecord(domain: string, record: DnsRecord): Promise<void> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.deleteRecord(domain, record);
  },

  initiateTransfer(domain: string, authCode: string): Promise<DomainTransfer> {
    let adapter: DomainAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.initiateTransfer(domain, authCode);
  },
});

export default lazyAdapter;
