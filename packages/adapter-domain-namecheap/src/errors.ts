/**
 * Error codes + helpers for the Namecheap domain adapter.
 *
 * Every AgentryError in this package flows through `namecheapError(init)`.
 * No direct `new AgentryError(...)` calls anywhere. This closes Plan J
 * deferred follow-up #3 (storage-r2's `networkErr` bypassed `r2Error()`);
 * Plan K introduced the pattern and Plan L carries it forward.
 *
 * @module
 */

import { AgentryError, type AgentryErrorInit, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'domain-namecheap' as const;

/** Stable runtime error codes for the Namecheap adapter. */
export const NAMECHEAP_ERROR_CODES = {
  /** Bad API user / API key / disabled account / suspended user. */
  AUTH: 'E_NAMECHEAP_AUTH',
  /** ClientIp is not on the Namecheap account whitelist. */
  IP_NOT_WHITELISTED: 'E_NAMECHEAP_IP_NOT_WHITELISTED',
  /** Domain not in user's account or not registered (for getInfo-style lookups). */
  DOMAIN_NOT_FOUND: 'E_NAMECHEAP_DOMAIN_NOT_FOUND',
  /** Input validation: bad domain shape, unsupported TLD, malformed DNS record, premium domain rejected, etc. */
  INVALID: 'E_NAMECHEAP_INVALID',
  /** Rate-limited by Namecheap. */
  RATE_LIMIT: 'E_NAMECHEAP_RATE_LIMIT',
  /** fetch-level failure: DNS, TCP, abort, timeout. */
  NETWORK: 'E_NAMECHEAP_NETWORK',
  /** HTTP 5xx or unmapped Namecheap error Number. */
  UPSTREAM: 'E_NAMECHEAP_UPSTREAM',
  /**
   * Transient code thrown only by `parseNamecheapDomainConfig()` when zod
   * rejects the input shape. Never appears during method calls.
   */
  SCHEMA: 'E_NAMECHEAP_SCHEMA',
} as const;

export type NamecheapErrorCode = (typeof NAMECHEAP_ERROR_CODES)[keyof typeof NAMECHEAP_ERROR_CODES];

/**
 * Map from Namecheap `<Error Number="N">` strings to adapter error codes.
 * Unmapped Numbers fall through to UPSTREAM in `numberToCode`.
 */
const NUMBER_TO_CODE = new Map<string, NamecheapErrorCode>([
  // AUTH
  ['1010101', NAMECHEAP_ERROR_CODES.AUTH],
  ['1010102', NAMECHEAP_ERROR_CODES.AUTH],
  ['1010104', NAMECHEAP_ERROR_CODES.AUTH],
  ['1010105', NAMECHEAP_ERROR_CODES.AUTH],
  ['1010900', NAMECHEAP_ERROR_CODES.AUTH],
  ['1011102', NAMECHEAP_ERROR_CODES.AUTH],
  ['1011104', NAMECHEAP_ERROR_CODES.AUTH],
  ['1011105', NAMECHEAP_ERROR_CODES.AUTH],
  ['1017200', NAMECHEAP_ERROR_CODES.AUTH],
  // IP_NOT_WHITELISTED
  ['1011147', NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED],
  ['1011148', NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED],
  ['1017147', NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED],
  ['1017148', NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED],
  // DOMAIN_NOT_FOUND
  ['2019166', NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND],
  ['2030280', NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND],
  ['2030166', NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND],
  ['4010331', NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND],
  ['5050900', NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND],
  // INVALID
  ['2010324', NAMECHEAP_ERROR_CODES.INVALID],
  ['2011170', NAMECHEAP_ERROR_CODES.INVALID],
  ['2011280', NAMECHEAP_ERROR_CODES.INVALID],
  ['2011300', NAMECHEAP_ERROR_CODES.INVALID],
  ['2030288', NAMECHEAP_ERROR_CODES.INVALID],
  ['2050900', NAMECHEAP_ERROR_CODES.INVALID],
  ['2051900', NAMECHEAP_ERROR_CODES.INVALID],
  ['4011331', NAMECHEAP_ERROR_CODES.INVALID],
  ['4011332', NAMECHEAP_ERROR_CODES.INVALID],
  // RATE_LIMIT
  ['4023273', NAMECHEAP_ERROR_CODES.RATE_LIMIT],
  ['4023274', NAMECHEAP_ERROR_CODES.RATE_LIMIT],
]);

/**
 * Look up a Namecheap `<Error Number="...">` string and return the
 * corresponding adapter error code, or `undefined` when unmapped.
 * Callers should default to `UPSTREAM` on `undefined`.
 */
export function numberToCode(numberStr: string): NamecheapErrorCode | undefined {
  return NUMBER_TO_CODE.get(numberStr);
}

/**
 * Minimal shape of a parsed Namecheap XML envelope needed by
 * `apiResponseError`. The full `xml.ts` parser returns a richer object;
 * this interface only names the fields errors.ts cares about so the two
 * modules remain loosely coupled.
 */
export interface ApiResponseEnvelope {
  ApiResponse: {
    '@_Status': string;
    Errors?: {
      Error?:
        | { '@_Number': string; '#text': string }
        | Array<{ '@_Number': string; '#text': string }>;
    };
  };
}

/** Construct an AgentryError with this adapter's id pre-filled. */
export function namecheapError(init: AgentryErrorInit): AgentryError {
  const body: AgentryErrorInit = {
    ...init,
    adapter: ADAPTER_ID,
  };
  return new AgentryError(body);
}

/**
 * Map a non-2xx HTTP response to an AgentryError.
 *
 * - HTTP 5xx → UPSTREAM
 * - HTTP 401/403 → AUTH
 * - HTTP 429 → RATE_LIMIT
 * - Everything else → UPSTREAM
 *
 * `body` is the raw response text (already read by the caller so we don't
 * double-consume the stream). Truncated to 500 chars in `context.responseBody`.
 */
export function httpToNamecheapError(
  httpStatus: number,
  body: string,
  phase: AgentryErrorPhase,
): AgentryError {
  const truncated = body.length > 500 ? body.slice(0, 500) : body;
  const context: Record<string, unknown> = { httpStatus, responseBody: truncated };

  if (httpStatus === 401 || httpStatus === 403) {
    return namecheapError({
      code: NAMECHEAP_ERROR_CODES.AUTH,
      message: `Namecheap returned HTTP ${httpStatus}: authentication failed`,
      phase,
      suggestedFix:
        'Verify OA_NAMECHEAP_API_USER and OA_NAMECHEAP_API_KEY are set correctly. Check that your API access is enabled at Namecheap → Profile → Tools → API Access.',
      adapter: ADAPTER_ID,
      context,
    });
  }

  if (httpStatus === 429) {
    return namecheapError({
      code: NAMECHEAP_ERROR_CODES.RATE_LIMIT,
      message: `Namecheap returned HTTP 429: rate-limited`,
      phase,
      suggestedFix:
        'Namecheap rate-limited the request. Back off and retry. Namecheap imposes per-minute and per-day API limits.',
      adapter: ADAPTER_ID,
      context,
    });
  }

  if (httpStatus >= 500) {
    return namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: `Namecheap returned HTTP ${httpStatus}: upstream error`,
      phase,
      suggestedFix:
        'Namecheap returned a server error. Check https://www.namecheap.com/status/ and retry.',
      adapter: ADAPTER_ID,
      context,
    });
  }

  // Catch-all for any other unexpected HTTP status.
  return namecheapError({
    code: NAMECHEAP_ERROR_CODES.UPSTREAM,
    message: `Namecheap returned unexpected HTTP ${httpStatus}`,
    phase,
    suggestedFix:
      'Namecheap returned an unexpected HTTP status. Check https://www.namecheap.com/status/ and retry.',
    adapter: ADAPTER_ID,
    context,
  });
}

/**
 * Given a parsed XML envelope with `Status="ERROR"`, extract the first
 * `<Error Number="N">message</Error>`, map the Number to a code, and
 * return an AgentryError with `context.namecheapNumber` and
 * `context.namecheapMessage` set.
 *
 * Unmapped Numbers produce `UPSTREAM`. The raw Number string and message
 * are always preserved in `context` for debugging.
 */
export function apiResponseError(
  parsedXml: ApiResponseEnvelope,
  phase: AgentryErrorPhase,
): AgentryError {
  const errorsNode = parsedXml.ApiResponse.Errors;
  const firstError = (() => {
    if (!errorsNode?.Error) return undefined;
    return Array.isArray(errorsNode.Error) ? errorsNode.Error[0] : errorsNode.Error;
  })();

  const numberStr = firstError?.['@_Number'] ?? 'unknown';
  const namecheapMessage = firstError?.['#text'] ?? 'unknown error';
  const code = numberToCode(numberStr) ?? NAMECHEAP_ERROR_CODES.UPSTREAM;

  const context: Record<string, unknown> = {
    namecheapNumber: numberStr,
    namecheapMessage,
  };

  // Produce a human-readable suggestedFix tuned to each code.
  let suggestedFix: string;
  switch (code) {
    case NAMECHEAP_ERROR_CODES.AUTH:
      suggestedFix =
        'Namecheap rejected the API credentials. Verify OA_NAMECHEAP_API_USER and OA_NAMECHEAP_API_KEY are correct and that API access is enabled on your account.';
      break;
    case NAMECHEAP_ERROR_CODES.IP_NOT_WHITELISTED:
      suggestedFix =
        `The IP address in OA_NAMECHEAP_CLIENT_IP is not on your Namecheap API whitelist. ` +
        `Go to Namecheap → Profile → Tools → API Access and add the IP, or set OA_NAMECHEAP_CLIENT_IP to a whitelisted IP.`;
      break;
    case NAMECHEAP_ERROR_CODES.DOMAIN_NOT_FOUND:
      suggestedFix =
        'The domain was not found in your Namecheap account. Verify the domain is registered under this account. ' +
        'If the domain has a multi-label TLD (e.g. .co.uk), the SLD/TLD split may be incorrect — check the adapter logs.';
      break;
    case NAMECHEAP_ERROR_CODES.INVALID:
      suggestedFix =
        `Namecheap rejected the request as invalid (Number ${numberStr}): "${namecheapMessage}". ` +
        `Check the input domain name, DNS record fields, and TLD support.`;
      break;
    case NAMECHEAP_ERROR_CODES.RATE_LIMIT:
      suggestedFix =
        'Namecheap rate-limited the request. Back off and retry. Namecheap imposes per-minute and per-day API call limits.';
      break;
    default:
      suggestedFix =
        `Namecheap returned an unmapped error (Number ${numberStr}): "${namecheapMessage}". ` +
        `Check https://www.namecheap.com/support/api/intro/ for error code documentation.`;
      break;
  }

  return namecheapError({
    code,
    message: `Namecheap API error ${numberStr}: ${namecheapMessage}`,
    phase,
    suggestedFix,
    adapter: ADAPTER_ID,
    context,
  });
}

/** Map a thrown `fetch` rejection to an AgentryError with code NETWORK. */
export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return namecheapError({
    code: NAMECHEAP_ERROR_CODES.NETWORK,
    message: `Network error reaching Namecheap API: ${message}`,
    phase,
    suggestedFix:
      'A network-level error prevented the request from reaching api.namecheap.com (or api.sandbox.namecheap.com). Verify connectivity and DNS resolution.',
    adapter: ADAPTER_ID,
    context: { cause: message },
    cause,
  });
}
