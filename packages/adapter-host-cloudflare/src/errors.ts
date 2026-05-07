/**
 * Stable error codes + mappers from Cloudflare API failures to AgentryError.
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';
import type { CfApiResponse } from './types.js';

export const CF_ERROR_CODES = {
  AUTH: 'E_CF_AUTH',
  NOT_FOUND: 'E_CF_NOT_FOUND',
  RATE_LIMITED: 'E_CF_RATE_LIMITED',
  HTTP: 'E_CF_HTTP',
  NETWORK: 'E_CF_NETWORK',
  // reserved for future schema-validation errors
  SCHEMA: 'E_CF_SCHEMA',
  PAGES_API: 'E_CF_PAGES_API',
} as const;

export const ADAPTER_ID = 'host-cloudflare' as const;

const AUTH_DOC = 'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/';

/**
 * Map a Cloudflare envelope-level failure (`success: false`) to AgentryError.
 * The Cloudflare error code 10000 (and 10000-10099) is the documented auth
 * family — promote those to E_CF_AUTH so callers can react usefully.
 */
export function cfErrorFromResponse<T>(
  phase: AgentryErrorPhase,
  body: CfApiResponse<T>,
): AgentryError {
  const first = body.errors[0];
  const isAuth = first !== undefined && first.code >= 10000 && first.code < 10100;
  if (isAuth) {
    return new AgentryError({
      code: CF_ERROR_CODES.AUTH,
      message: `Cloudflare authentication failed: ${first.message}`,
      phase,
      adapter: ADAPTER_ID,
      suggestedFix:
        'Verify CLOUDFLARE_API_TOKEN has the "Pages:Edit" + "Account:Read" permissions for the target account.',
      docs: AUTH_DOC,
      context: { cf_code: first.code },
    });
  }
  return new AgentryError({
    code: CF_ERROR_CODES.PAGES_API,
    message:
      first !== undefined
        ? `Cloudflare API call failed: ${first.message}`
        : `Cloudflare API call failed (no error message in response)`,
    phase,
    adapter: ADAPTER_ID,
    context:
      first !== undefined
        ? { cf_code: first.code, all_errors: body.errors }
        : { all_errors: body.errors },
  });
}

/** Map an HTTP-level failure (response.ok === false). */
export function cfErrorFromHttp(
  phase: AgentryErrorPhase,
  status: number,
  bodyText: string,
): AgentryError {
  if (status === 401 || status === 403) {
    return new AgentryError({
      code: CF_ERROR_CODES.AUTH,
      message: `Cloudflare returned HTTP ${status}: ${bodyText.slice(0, 200)}`,
      phase,
      adapter: ADAPTER_ID,
      suggestedFix: 'Verify CLOUDFLARE_API_TOKEN is valid and has the required Pages permissions.',
      docs: AUTH_DOC,
      context: { status },
    });
  }
  if (status === 404) {
    return new AgentryError({
      code: CF_ERROR_CODES.NOT_FOUND,
      message: `Cloudflare returned HTTP 404: ${bodyText.slice(0, 200)}`,
      phase,
      adapter: ADAPTER_ID,
      context: { status },
    });
  }
  if (status === 429) {
    return new AgentryError({
      code: CF_ERROR_CODES.RATE_LIMITED,
      message: `Cloudflare rate-limited the request (HTTP 429).`,
      phase,
      adapter: ADAPTER_ID,
      suggestedFix: 'Back off and retry after the delay indicated in the Retry-After header.',
      context: { status },
    });
  }
  return new AgentryError({
    code: CF_ERROR_CODES.HTTP,
    message: `Cloudflare returned HTTP ${status}: ${bodyText.slice(0, 200)}`,
    phase,
    adapter: ADAPTER_ID,
    context: { status },
  });
}

/** Wrap an unexpected `cause` (network failure, JSON parse error). */
export function cfErrorFromCause(phase: AgentryErrorPhase, cause: unknown): AgentryError {
  if (isAgentryError(cause)) return cause;
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown';
  return new AgentryError({
    code: CF_ERROR_CODES.NETWORK,
    message: `Cloudflare API call did not complete: ${message}`,
    phase,
    adapter: ADAPTER_ID,
    cause,
  });
}
