/**
 * DomainAdapter — registrar integration: buy, transfer, manage DNS.
 *
 * @module
 */

import type { IsoTimestamp } from '../types.js';

export interface Domain {
  domain: string;
  registrar: string;
  registeredAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  autoRenew: boolean;
}

export interface DomainAvailability {
  domain: string;
  available: boolean;
  priceUsd?: number;
  currency?: string;
}

export interface DnsRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SRV';
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

export interface DomainTransfer {
  domain: string;
  /** Provider-specific transfer/order id. */
  transferId: string;
  status: 'pending' | 'confirmed' | 'failed';
  authCode?: string;
}

export interface DomainAdapter {
  readonly category: 'domain';
  readonly id: string;

  checkAvailability(domain: string): Promise<DomainAvailability>;
  purchase(domain: string, years?: number): Promise<Domain>;

  listRecords(domain: string): Promise<DnsRecord[]>;
  setRecord(domain: string, record: DnsRecord): Promise<DnsRecord>;
  deleteRecord(domain: string, record: DnsRecord): Promise<void>;

  initiateTransfer(domain: string, authCode: string): Promise<DomainTransfer>;
}
