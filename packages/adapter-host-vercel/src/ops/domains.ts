/**
 * attachDomain / detachDomain.
 *
 * @module
 */

import type { DomainAttachment, HostProject } from '@openagentry/core';
import type { VercelHostConfig } from '../config.js';
import { vercelFetch } from '../http.js';

/** Subset of a Vercel verification record. */
interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

/** Vercel response from POST /v10/projects/{idOrName}/domains */
interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: VercelVerification[];
}

/** DNS record types we recognise (Vercel may return lower- or upper-case). */
const KNOWN_DNS_TYPES = new Set(['a', 'aaaa', 'cname', 'txt', 'mx']);

/**
 * Map Vercel verification records to the DomainAttachment.pendingRecords shape.
 * Only entries whose `type` (case-insensitive) matches a known DNS record type
 * are included; challenge-token types (e.g. "TXT_VERIFY") are filtered out.
 * Types are normalised to uppercase to match the core DomainAttachment interface.
 */
export function mapVerificationToDnsRecords(
  verification: VercelVerification[],
): DomainAttachment['pendingRecords'] {
  const out: DomainAttachment['pendingRecords'] = [];
  for (const v of verification) {
    const normalised = v.type.toLowerCase();
    if (!KNOWN_DNS_TYPES.has(normalised)) continue;
    out!.push({
      type: normalised.toUpperCase() as 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX',
      name: v.domain,
      value: v.value,
    });
  }
  return out;
}

function mapDomainResponse(raw: VercelDomainResponse): DomainAttachment {
  let status: DomainAttachment['status'];
  if (raw.verified) {
    status = 'active';
  } else {
    // If the first verification entry explains a hard failure, surface 'failed'.
    const firstReason = raw.verification?.[0]?.reason ?? '';
    status = firstReason.toLowerCase().includes('fail') ? 'failed' : 'pending';
  }

  const pendingRecords = raw.verified
    ? []
    : mapVerificationToDnsRecords(raw.verification ?? []);

  const result: DomainAttachment = {
    domain: raw.name,
    status,
  };
  if (pendingRecords !== undefined && pendingRecords.length > 0) {
    result.pendingRecords = pendingRecords;
  }
  return result;
}

export async function attachDomain(
  cfg: VercelHostConfig,
  p: HostProject,
  domain: string,
): Promise<DomainAttachment> {
  const resp = await vercelFetch(
    cfg,
    'POST',
    `/v10/projects/${p.slug}/domains`,
    { name: domain },
    'attachDomain',
  );
  return mapDomainResponse(resp.json as VercelDomainResponse);
}

export async function detachDomain(
  cfg: VercelHostConfig,
  p: HostProject,
  domain: string,
): Promise<void> {
  await vercelFetch(
    cfg,
    'DELETE',
    `/v9/projects/${p.slug}/domains/${encodeURIComponent(domain)}`,
    undefined,
    'detachDomain',
  );
}
