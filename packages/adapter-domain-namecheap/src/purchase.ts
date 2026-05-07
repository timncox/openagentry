/**
 * Implementation of DomainAdapter.purchase for Namecheap.
 * Calls namecheap.domains.create (registers the domain), then follows up
 * with namecheap.domains.getInfo to populate registeredAt / expiresAt /
 * autoRenew.
 *
 * Contact information is required at purchase time. If cfg.contact is absent,
 * an E_NAMECHEAP_INVALID error is thrown listing all 9 contact env-var names.
 *
 * @module
 */

import type { Domain } from '@openagentry/core';
import type { NamecheapDomainConfig } from './config.js';
import { namecheapFetch } from './http.js';
import { namecheapError, NAMECHEAP_ERROR_CODES } from './errors.js';
import { xmlBool, xmlString } from './xml.js';

// ---------------------------------------------------------------------------
// Date parsing — Namecheap returns dates as MM/DD/YYYY (no time component).
// We convert to ISO 8601 UTC midnight.
// ---------------------------------------------------------------------------

/**
 * Parses a Namecheap date string in MM/DD/YYYY format into a UTC ISO 8601
 * timestamp string. Does not depend on date-fns or any external date library.
 *
 * @example parseNamecheapDate('05/07/2026') → '2026-05-07T00:00:00.000Z'
 */
export function parseNamecheapDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(
      `Cannot parse Namecheap date "${dateStr}": expected MM/DD/YYYY format.`,
    );
  }
  const [mm, dd, yyyy] = parts as [string, string, string];
  // Pad to ensure well-formed ISO segment — Namecheap always sends zero-padded,
  // but be defensive.
  const month = mm.padStart(2, '0');
  const day = dd.padStart(2, '0');
  const year = yyyy;
  // Use Date constructor with explicit UTC midnight to avoid timezone shifts.
  const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (isNaN(d.getTime())) {
    throw new Error(
      `Cannot parse Namecheap date "${dateStr}": resulted in an invalid Date.`,
    );
  }
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Contact param builder — applies the same contact to all four required roles.
// ---------------------------------------------------------------------------

const CONTACT_ROLES = ['Registrant', 'Tech', 'Admin', 'AuxBilling'] as const;

interface ContactBlock {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
}

function buildContactParams(contact: ContactBlock): Record<string, string> {
  const params: Record<string, string> = {};
  for (const role of CONTACT_ROLES) {
    params[`${role}FirstName`] = contact.firstName;
    params[`${role}LastName`] = contact.lastName;
    params[`${role}Address1`] = contact.address1;
    params[`${role}City`] = contact.city;
    params[`${role}StateProvince`] = contact.stateProvince;
    params[`${role}PostalCode`] = contact.postalCode;
    params[`${role}Country`] = contact.country;
    params[`${role}Phone`] = contact.phone;
    params[`${role}EmailAddress`] = contact.email;
  }
  return params;
}

// The 9 contact env-var names (for use in error context).
const CONTACT_ENV_VAR_NAMES = [
  'OA_NAMECHEAP_CONTACT_FIRST_NAME',
  'OA_NAMECHEAP_CONTACT_LAST_NAME',
  'OA_NAMECHEAP_CONTACT_ADDRESS1',
  'OA_NAMECHEAP_CONTACT_CITY',
  'OA_NAMECHEAP_CONTACT_STATE_PROVINCE',
  'OA_NAMECHEAP_CONTACT_POSTAL_CODE',
  'OA_NAMECHEAP_CONTACT_COUNTRY',
  'OA_NAMECHEAP_CONTACT_PHONE',
  'OA_NAMECHEAP_CONTACT_EMAIL',
] as const;

// ---------------------------------------------------------------------------
// Public op
// ---------------------------------------------------------------------------

export async function purchase(
  cfg: NamecheapDomainConfig,
  domain: string,
  years?: number,
): Promise<Domain> {
  // Validate contact presence before any network call
  if (cfg.contact == null) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.INVALID,
      message:
        'purchase() requires contact information but cfg.contact is not set. ' +
        'All 9 contact env vars must be provided: ' +
        CONTACT_ENV_VAR_NAMES.join(', '),
      phase: 'write',
      context: { missing: [...CONTACT_ENV_VAR_NAMES] },
      suggestedFix:
        `Set all 9 OA_NAMECHEAP_CONTACT_* environment variables: ` +
        CONTACT_ENV_VAR_NAMES.join(', ') +
        '. These are used as the Registrant, Tech, Admin, and AuxBilling contact for the domain purchase.',
    });
  }

  const contactParams = buildContactParams(cfg.contact);

  // Step 1: Register the domain
  await namecheapFetch(
    cfg,
    'namecheap.domains.create',
    {
      DomainName: domain,
      Years: String(years ?? 1),
      ...contactParams,
    },
    'write',
  );

  // Step 2: Fetch domain details to populate registeredAt / expiresAt / autoRenew
  const infoEnvelope = await namecheapFetch(
    cfg,
    'namecheap.domains.getInfo',
    { DomainName: domain },
    'write',
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getInfoResult = (infoEnvelope as any)?.ApiResponse?.CommandResponse?.DomainGetInfoResult;
  const details = getInfoResult?.DomainDetails;

  if (details == null) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: `Namecheap getInfo response missing DomainDetails for "${domain}" after purchase.`,
      phase: 'write',
      suggestedFix:
        'The domain was likely registered successfully. Retry getInfo separately to confirm dates, or check the Namecheap dashboard.',
    });
  }

  const createdDateRaw = xmlString(details.CreatedDate);
  const expiredDateRaw = xmlString(details.ExpiredDate);

  if (!createdDateRaw || !expiredDateRaw) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: `Namecheap getInfo response missing CreatedDate or ExpiredDate for "${domain}".`,
      phase: 'write',
      suggestedFix: 'Retry getInfo after a short delay — the domain may still be provisioning.',
    });
  }

  const autoRenew = xmlBool(getInfoResult?.['@_IsAutoRenew']);

  return {
    domain,
    registrar: 'namecheap',
    registeredAt: parseNamecheapDate(createdDateRaw),
    expiresAt: parseNamecheapDate(expiredDateRaw),
    autoRenew,
  };
}
