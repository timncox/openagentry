/**
 * DNS operations for the Namecheap DomainAdapter: listRecords, setRecord,
 * deleteRecord. All three are backed by Namecheap's getHosts / setHosts
 * commands which require a read-modify-write cycle because setHosts replaces
 * ALL records on the domain simultaneously.
 *
 * WARNING: setRecord and deleteRecord are NOT atomic. Concurrent callers
 * mutating the same domain can produce lost updates. Callers must serialize
 * mutations. See LLM.md for details.
 *
 * @module
 */

import type { DnsRecord } from '@openagentry/core';
import type { NamecheapDomainConfig } from './config.js';
import { namecheapFetch } from './http.js';
import { xmlInt, xmlString } from './xml.js';
import { namecheapError, NAMECHEAP_ERROR_CODES } from './errors.js';

// ---------------------------------------------------------------------------
// Known double-label TLDs. When a domain ends with one of these, we split
// before the last two labels rather than at the last dot.
// ---------------------------------------------------------------------------
const DOUBLE_LABEL_TLDS = new Set([
  'co.uk',
  'com.br',
  'co.nz',
  'com.au',
  'co.in',
  'co.jp',
  'co.kr',
  'com.sg',
  'co.za',
  'com.mx',
  'com.ar',
  'co.th',
  'com.tw',
]);

export interface SplitDomain {
  sld: string;
  tld: string;
}

/**
 * Splits a fully-qualified domain into SLD and TLD for Namecheap's DNS API.
 * Handles known double-label TLDs (co.uk, com.br, etc.). Unrecognised
 * multi-label TLDs fall back to the last-dot heuristic.
 *
 * Examples:
 *   example.com       → { sld: 'example',     tld: 'com' }
 *   www.example.com   → { sld: 'www.example', tld: 'com' }
 *   example.co.uk     → { sld: 'example',     tld: 'co.uk' }
 *   a.b.example.co.uk → { sld: 'a.b.example', tld: 'co.uk' }
 */
export function splitDomain(domain: string): SplitDomain {
  const lower = domain.toLowerCase();
  for (const tld of DOUBLE_LABEL_TLDS) {
    if (lower === tld || lower.endsWith('.' + tld)) {
      // The sld is everything before '.' + tld
      const suffix = '.' + tld;
      const sld = domain.slice(0, domain.length - suffix.length);
      if (sld.length > 0) {
        return { sld, tld };
      }
    }
  }
  // Fallback: split at the last dot
  const lastDot = domain.lastIndexOf('.');
  if (lastDot === -1) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      message: `Cannot split "${domain}" into SLD/TLD: no dot found.`,
      phase: 'read',
      suggestedFix: 'Provide a fully-qualified domain name such as example.com.',
    });
  }
  return {
    sld: domain.slice(0, lastDot),
    tld: domain.slice(lastDot + 1),
  };
}

// ---------------------------------------------------------------------------
// Record types where equality for the set/replace decision uses the full
// (name, type, value) triple rather than just (name, type). This is required
// for multi-value record types where multiple records can co-exist.
// ---------------------------------------------------------------------------
const MULTI_VALUE_TYPES = new Set<string>(['TXT', 'MX', 'SRV']);

/**
 * Determines whether two DnsRecords match for set/delete purposes.
 * byValue=false → match on (name, type) only (single-value record semantics).
 * byValue=true  → match on (name, type, value) triple (multi-value record semantics).
 */
export function recordsMatch(a: DnsRecord, b: DnsRecord, byValue: boolean): boolean {
  const nameMatch = a.name.toLowerCase() === b.name.toLowerCase();
  const typeMatch = a.type === b.type;
  if (!byValue) return nameMatch && typeMatch;
  return nameMatch && typeMatch && a.value === b.value;
}

/**
 * Parses the CommandResponse.DomainDNSGetHostsResult.host array from the
 * namecheap.domains.dns.getHosts envelope into DnsRecord[].
 */
export function parseHostsResponse(envelope: unknown): DnsRecord[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (envelope as any)?.ApiResponse?.CommandResponse?.DomainDNSGetHostsResult;
  if (result == null) return [];

  // Namecheap returns a single object when there's one record, or an array
  // when there are multiple. The isArray config in xml.ts forces arrays for
  // the known jpath, but we guard defensively here too.
  const rawHosts = result.host;
  if (rawHosts == null) return [];
  const hosts: unknown[] = Array.isArray(rawHosts) ? rawHosts : [rawHosts];

  return hosts.map((h): DnsRecord => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = h as any;
    const type = (xmlString(node['@_Type']) ?? 'A') as DnsRecord['type'];
    const name = xmlString(node['@_Name']) ?? '@';
    const value = xmlString(node['@_Address']) ?? '';
    const ttl = xmlInt(node['@_TTL']);
    const priority = xmlInt(node['@_MXPref']);

    const record: DnsRecord = { type, name, value };
    if (ttl !== undefined) record.ttl = ttl;
    if (priority !== undefined && MULTI_VALUE_TYPES.has(type)) {
      record.priority = priority;
    }
    return record;
  });
}

/**
 * Converts a DnsRecord[] into the flat indexed query-param object that
 * namecheap.domains.dns.setHosts expects.
 *
 * HostName1=..., RecordType1=..., Address1=..., TTL1=..., MXPref1=... (1-indexed).
 * MXPref is required for MX records; for others Namecheap ignores it but we
 * include a default of 10 to avoid API warnings.
 */
export function recordsToHostsParams(records: DnsRecord[]): Record<string, string> {
  const params: Record<string, string> = {};
  records.forEach((r, i) => {
    const n = i + 1;
    params[`HostName${n}`] = r.name;
    params[`RecordType${n}`] = r.type;
    params[`Address${n}`] = r.value;
    params[`TTL${n}`] = String(r.ttl ?? 1800);
    params[`MXPref${n}`] = String(r.priority ?? 10);
  });
  return params;
}

// ---------------------------------------------------------------------------
// Public ops
// ---------------------------------------------------------------------------

/**
 * Lists all DNS records for a domain via namecheap.domains.dns.getHosts.
 */
export async function listRecords(
  cfg: NamecheapDomainConfig,
  domain: string,
): Promise<DnsRecord[]> {
  const { sld, tld } = splitDomain(domain);
  const envelope = await namecheapFetch(
    cfg,
    'namecheap.domains.dns.getHosts',
    { SLD: sld, TLD: tld },
    'read',
  );
  return parseHostsResponse(envelope);
}

/**
 * Sets a single DNS record on a domain. Uses a read-modify-write cycle
 * because Namecheap's setHosts replaces all records.
 *
 * For single-value record types (A, AAAA, CNAME, NS): replaces any existing
 * record with the same (name, type); appends if none exists.
 *
 * For multi-value record types (TXT, MX, SRV): replaces any existing record
 * with the same (name, type, value) triple; appends otherwise. Two TXT records
 * with the same name but different values are BOTH preserved.
 */
export async function setRecord(
  cfg: NamecheapDomainConfig,
  domain: string,
  record: DnsRecord,
): Promise<DnsRecord> {
  const { sld, tld } = splitDomain(domain);
  const existing = await listRecords(cfg, domain);
  const byValue = MULTI_VALUE_TYPES.has(record.type);

  let replaced = false;
  const updated = existing.map((r) => {
    if (recordsMatch(r, record, byValue)) {
      replaced = true;
      return record;
    }
    return r;
  });
  if (!replaced) updated.push(record);

  const hostsParams = recordsToHostsParams(updated);
  await namecheapFetch(
    cfg,
    'namecheap.domains.dns.setHosts',
    { SLD: sld, TLD: tld, ...hostsParams },
    'write',
  );

  return record;
}

/**
 * Deletes a single DNS record from a domain. Uses a read-modify-write cycle.
 * Matches on (name, type, value) triple — required to avoid over-deleting when
 * multiple records share the same name and type (e.g., multiple TXTs).
 *
 * Idempotent: if no record matches the triple, the unchanged record list is
 * written back (no error thrown).
 */
export async function deleteRecord(
  cfg: NamecheapDomainConfig,
  domain: string,
  record: DnsRecord,
): Promise<void> {
  const { sld, tld } = splitDomain(domain);
  const existing = await listRecords(cfg, domain);
  // Always match by full triple for delete to avoid over-deletion
  const filtered = existing.filter((r) => !recordsMatch(r, record, true));

  const hostsParams = recordsToHostsParams(filtered);
  await namecheapFetch(
    cfg,
    'namecheap.domains.dns.setHosts',
    { SLD: sld, TLD: tld, ...hostsParams },
    'delete',
  );
}
