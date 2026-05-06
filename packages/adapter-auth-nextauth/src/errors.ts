/**
 * Stable error codes for the next-auth adapter. Smaller surface than the
 * cloudflare or neon adapters because auth verification is local — no
 * rate-limit / HTTP-status paths.
 *
 * @module
 */

import {
  AgentryError,
  isAgentryError,
  type AgentryErrorPhase,
} from '@openagentry/core';

export const NEXT_AUTH_ERROR_CODES = {
  /** Adapter-side authentication failure (missing/invalid secret detected at adapter init). */
  AUTH: 'E_NEXTAUTH_AUTH',
  /** Resource not found (e.g., session-token cookie absent on database lookup). */
  NOT_FOUND: 'E_NEXTAUTH_NOT_FOUND',
  /** Input validation error thrown by the adapter (bad strategy, etc.). */
  SCHEMA: 'E_NEXTAUTH_SCHEMA',
  /** Unexpected runtime failure during local verification (next-auth internals threw). */
  NETWORK: 'E_NEXTAUTH_NETWORK',
  /** Reserved for future adapter-internal failures. */
  API: 'E_NEXTAUTH_API',
} as const;

export type NextAuthErrorCode =
  (typeof NEXT_AUTH_ERROR_CODES)[keyof typeof NEXT_AUTH_ERROR_CODES];

export const ADAPTER_ID = 'auth-nextauth';

export interface NextAuthErrorInit {
  code: NextAuthErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix?: string;
  docs?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

/** Build an AgentryError tagged for this adapter. */
export function nextAuthError(init: NextAuthErrorInit): AgentryError {
  return new AgentryError({
    code: init.code,
    message: init.message,
    phase: init.phase,
    adapter: ADAPTER_ID,
    ...(init.suggestedFix !== undefined ? { suggestedFix: init.suggestedFix } : {}),
    ...(init.docs !== undefined ? { docs: init.docs } : {}),
    ...(init.context !== undefined ? { context: init.context } : {}),
    ...(init.cause !== undefined ? { cause: init.cause } : {}),
  });
}

/**
 * Wrap an unknown thrown cause (typically next-auth internals) as an
 * AgentryError. Existing AgentryErrors are passed through unchanged so
 * causes that originated in `nextAuthError()` keep their codes.
 */
export function nextAuthErrorFromCause(
  phase: AgentryErrorPhase,
  cause: unknown,
): AgentryError {
  if (isAgentryError(cause)) return cause;
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
      ? cause
      : 'unknown';
  return nextAuthError({
    code: NEXT_AUTH_ERROR_CODES.NETWORK,
    message: `next-auth call did not complete: ${message}`,
    phase,
    cause,
  });
}
