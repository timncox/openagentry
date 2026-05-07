/**
 * Namecheap DomainAdapter factory. Returns a frozen object implementing the core
 * DomainAdapter interface. Each method delegates to the corresponding op function.
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
import {
  parseNamecheapDomainConfig,
  type NamecheapDomainConfigInput,
  type NamecheapDomainConfig,
} from './config.js';
import { checkAvailability } from './availability.js';
import { purchase } from './purchase.js';
import { listRecords, setRecord, deleteRecord } from './dns.js';
import { initiateTransfer } from './transfer.js';
import { ADAPTER_ID } from './errors.js';

export function createNamecheapDomainAdapter(
  input: NamecheapDomainConfigInput,
): DomainAdapter {
  const cfg: NamecheapDomainConfig = parseNamecheapDomainConfig(input);
  return Object.freeze({
    category: 'domain' as const,
    id: ADAPTER_ID,
    checkAvailability(domain: string): Promise<DomainAvailability> {
      return checkAvailability(cfg, domain);
    },
    purchase(domain: string, years?: number): Promise<Domain> {
      return purchase(cfg, domain, years);
    },
    listRecords(domain: string): Promise<DnsRecord[]> {
      return listRecords(cfg, domain);
    },
    setRecord(domain: string, record: DnsRecord): Promise<DnsRecord> {
      return setRecord(cfg, domain, record);
    },
    deleteRecord(domain: string, record: DnsRecord): Promise<void> {
      return deleteRecord(cfg, domain, record);
    },
    initiateTransfer(domain: string, authCode: string): Promise<DomainTransfer> {
      return initiateTransfer(cfg, domain, authCode);
    },
  });
}
