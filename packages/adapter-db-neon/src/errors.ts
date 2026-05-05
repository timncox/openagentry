/**
 * Stable error codes + mappers from Neon Console API failures to AgentryError.
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';
import type { NeonErrorBody } from './types.js';

export const NEON_ERROR_CODES = {
  AUTH: 'E_NEON_AUTH',
  NOT_FOUND: 'E_NEON_NOT_FOUND',
  RATE_LIMITED: 'E_NEON_RATE_LIMITED',
  HTTP: 'E_NEON_HTTP',
  NETWORK: 'E_NEON_NETWORK',
  // reserved for input-validation errors thrown by the adapter itself
  SCHEMA: 'E_NEON_SCHEMA',
  API: 'E_NEON_API',
} as const;

const ADAPTER_ID = 'db-neon';

const AUTH_DOC = 'https://neon.tech/docs/manage/api-keys';

/**
 * Map a Neon HTTP error response body to AgentryError.
 *
 * Neon returns JSON like `{ message: "...", code: "RESOURCE_NOT_FOUND" }`
 * for failures. Auth failures are 401/403 with code `RESOURCE_FORBIDDEN`
 * or similar; we promote those to E_NEON_AUTH so callers can react usefully.
 */
export function neonErrorFromResponse(
  phase: AgentryErrorPhase,
  status: number,
  body: NeonErrorBody | null,
): AgentryError {
  if (status === 401 || status === 403) {
    return new AgentryError({
      code: NEON_ERROR_CODES.AUTH,
      message: `Neon authentication failed: ${body?.message ?? 'unauthorized'}`,
      phase,
      adapter: ADAPTER_ID,
      suggestedFix:
        'Verify NEON_API_KEY is a valid personal API key with project-create scope.',
      docs: AUTH_DOC,
      ...(body?.code !== undefined ? { context: { neon_code: body.code } } : {}),
    });
  }
  if (status === 404) {
    return new AgentryError({
      code: NEON_ERROR_CODES.NOT_FOUND,
      message: `Neon resource not found: ${body?.message ?? 'not found'}`,
      phase,
      adapter: ADAPTER_ID,
      ...(body?.code !== undefined ? { context: { neon_code: body.code } } : {}),
    });
  }
  if (status === 429) {
    return new AgentryError({
      code: NEON_ERROR_CODES.RATE_LIMITED,
      message: `Neon rate limited: ${body?.message ?? 'too many requests'}`,
      phase,
      adapter: ADAPTER_ID,
      ...(body?.code !== undefined ? { context: { neon_code: body.code } } : {}),
    });
  }
  return new AgentryError({
    code: NEON_ERROR_CODES.HTTP,
    message: `Neon API call failed (HTTP ${status}): ${body?.message ?? 'unknown'}`,
    phase,
    adapter: ADAPTER_ID,
    ...(body?.code !== undefined ? { context: { neon_code: body.code, status } } : { context: { status } }),
  });
}

/** Map a thrown cause (network failure, body parse error) to AgentryError. */
export function neonErrorFromCause(phase: AgentryErrorPhase, cause: unknown): AgentryError {
  if (isAgentryError(cause)) return cause;
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown';
  return new AgentryError({
    code: NEON_ERROR_CODES.NETWORK,
    message: `Neon API call did not complete: ${message}`,
    phase,
    adapter: ADAPTER_ID,
    cause,
  });
}
