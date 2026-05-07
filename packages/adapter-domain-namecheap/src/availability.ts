/**
 * Implementation of DomainAdapter.checkAvailability for Namecheap.
 * Calls namecheap.domains.check and maps the XML response to the core
 * DomainAvailability interface.
 *
 * @module
 */

import type { DomainAvailability } from '@openagentry/core';
import type { NamecheapDomainConfig } from './config.js';
import { namecheapFetch } from './http.js';
import { namecheapError, NAMECHEAP_ERROR_CODES } from './errors.js';
import { xmlBool, xmlFloat, xmlString } from './xml.js';

/** Basic domain shape check: at least one label, a dot, then at least one label. */
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export async function checkAvailability(
  cfg: NamecheapDomainConfig,
  domain: string,
): Promise<DomainAvailability> {
  if (!DOMAIN_RE.test(domain)) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      message: `Invalid domain format: "${domain}". Expected a fully-qualified domain like example.com.`,
      phase: 'read',
      suggestedFix:
        'Provide a fully-qualified domain name containing only letters, digits, and hyphens, with at least one dot (e.g. example.com or sub.example.co.uk).',
    });
  }

  const envelope = await namecheapFetch(
    cfg,
    'namecheap.domains.check',
    { DomainList: domain },
    'read',
  );

  // Namecheap returns a single <DomainCheckResult> element or an array when
  // multiple domains are queried. We always query one, so coerce to object.
  const raw = (envelope as any)?.ApiResponse?.CommandResponse?.DomainCheckResult;
  const result = Array.isArray(raw) ? raw[0] : raw;

  if (result == null) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: 'Namecheap checkAvailability response missing DomainCheckResult element.',
      phase: 'read',
      suggestedFix: 'Retry the request. If the issue persists, verify the domain parameter is valid.',
    });
  }

  const available = xmlBool(result['@_Available']);
  const returnedDomain = xmlString(result['@_Domain']) ?? domain;
  const isPremium = result['@_IsPremiumName'] === 'true';
  const premiumPrice = isPremium ? xmlFloat(result['@_PremiumRegistrationPrice']) : undefined;

  return {
    domain: returnedDomain,
    available,
    ...(premiumPrice !== undefined ? { priceUsd: premiumPrice, currency: 'USD' } : {}),
  };
}
