/**
 * Read Namecheap domain adapter configuration from environment variables.
 *
 * Returns a two-branch discriminated union:
 *   ok=true  → all required vars present; `config` is ready to pass to
 *              `parseNamecheapDomainConfig`.
 *   ok=false → one or more required vars absent; `missing` lists them by name.
 *
 * The contact block is all-or-nothing: if all 9 OA_NAMECHEAP_CONTACT_* vars
 * are present the contact object is included; if any are missing the contact
 * is omitted entirely (purchase() will fail at call time with E_NAMECHEAP_INVALID
 * listing the missing env-var names).
 *
 * @module
 */

import type { NamecheapDomainConfigInput, NamecheapContactInput } from './config.js';

const REQUIRED_VARS = [
  'OA_NAMECHEAP_API_USER',
  'OA_NAMECHEAP_API_KEY',
  'OA_NAMECHEAP_CLIENT_IP',
] as const;

const CONTACT_VARS = [
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

export type EnvReadResult =
  | { ok: true; config: NamecheapDomainConfigInput }
  | { ok: false; missing: string[] };

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

export function readEnvConfig(env: NodeJS.ProcessEnv): EnvReadResult {
  const missing = REQUIRED_VARS.filter((k) => !env[k]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const config: NamecheapDomainConfigInput = {
    apiUser: env.OA_NAMECHEAP_API_USER!,
    apiKey: env.OA_NAMECHEAP_API_KEY!,
    clientIp: env.OA_NAMECHEAP_CLIENT_IP!,
  };

  if (env.OA_NAMECHEAP_USERNAME) {
    config.userName = env.OA_NAMECHEAP_USERNAME;
  }

  if (env.OA_NAMECHEAP_ENDPOINT) {
    config.endpoint = env.OA_NAMECHEAP_ENDPOINT;
  }

  if (env.OA_NAMECHEAP_USE_SANDBOX !== undefined) {
    config.useSandbox = isTruthy(env.OA_NAMECHEAP_USE_SANDBOX);
  }

  // Contact: all-or-nothing. If all 9 vars are present, build the contact
  // object. If any are absent, omit entirely (purchase() checks at call time).
  const contactValues = CONTACT_VARS.map((k) => env[k]);
  const allContactPresent = contactValues.every((v) => v !== undefined && v !== '');
  if (allContactPresent) {
    const contact: NamecheapContactInput = {
      firstName: env.OA_NAMECHEAP_CONTACT_FIRST_NAME!,
      lastName: env.OA_NAMECHEAP_CONTACT_LAST_NAME!,
      address1: env.OA_NAMECHEAP_CONTACT_ADDRESS1!,
      city: env.OA_NAMECHEAP_CONTACT_CITY!,
      stateProvince: env.OA_NAMECHEAP_CONTACT_STATE_PROVINCE!,
      postalCode: env.OA_NAMECHEAP_CONTACT_POSTAL_CODE!,
      country: env.OA_NAMECHEAP_CONTACT_COUNTRY!,
      phone: env.OA_NAMECHEAP_CONTACT_PHONE!,
      email: env.OA_NAMECHEAP_CONTACT_EMAIL!,
    };
    config.contact = contact;
  }

  return { ok: true, config };
}
