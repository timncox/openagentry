/**
 * Single HTTP chokepoint for the Namecheap XML API.
 *
 * All Namecheap API calls in this adapter pass through `namecheapFetch`.
 * It builds the authenticated query string, fires `fetch`, reads the body,
 * parses XML, and translates error envelopes and HTTP failures into
 * AgentryError.
 *
 * Per-op files (availability.ts, dns.ts, purchase.ts, transfer.ts) call this
 * function and never import `fetch` directly.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import type { NamecheapDomainConfig } from './config.js';
import {
  networkErr,
  httpToNamecheapError,
  apiResponseError,
} from './errors.js';
import { parseNamecheapXml, type ApiResponseEnvelope } from './xml.js';

/**
 * Fire a Namecheap API call and return the parsed `ApiResponseEnvelope`.
 *
 * @param cfg      - Validated adapter config (auth fields + endpoint).
 * @param command  - Namecheap command string, e.g. `'namecheap.domains.check'`.
 * @param params   - Command-specific params. `undefined` values are omitted.
 * @param phase    - The `AgentryErrorPhase` to attach to any thrown error.
 */
export async function namecheapFetch(
  cfg: NamecheapDomainConfig,
  command: string,
  params: Record<string, string | undefined>,
  phase: AgentryErrorPhase,
): Promise<ApiResponseEnvelope> {
  // Build query string: fixed auth fields + Command + caller params.
  const qs = new URLSearchParams();
  qs.set('ApiUser', cfg.apiUser);
  qs.set('ApiKey', cfg.apiKey);
  qs.set('UserName', cfg.userName ?? cfg.apiUser);
  qs.set('ClientIp', cfg.clientIp);
  qs.set('Command', command);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      qs.set(key, value);
    }
  }

  const url = `${cfg.endpoint}?${qs.toString()}`;

  // Fire the request — translate fetch-level errors to E_NAMECHEAP_NETWORK.
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw networkErr(cause, phase);
  }

  // Read the body as text (always XML, regardless of status code).
  let body: string;
  try {
    body = await response.text();
  } catch (cause) {
    throw networkErr(cause, phase);
  }

  // HTTP-level errors: 5xx → UPSTREAM; other non-2xx → UPSTREAM with status.
  if (!response.ok) {
    throw httpToNamecheapError(response.status, body, phase);
  }

  // Parse XML. parseNamecheapXml throws E_NAMECHEAP_UPSTREAM on malformed XML.
  const envelope = parseNamecheapXml(body);

  // API-level errors: Status="ERROR" → route through apiResponseError.
  if (envelope.ApiResponse['@_Status'] === 'ERROR') {
    throw apiResponseError(envelope, phase);
  }

  return envelope;
}
