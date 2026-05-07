/**
 * Error codes + helpers for the Resend email adapter.
 *
 * Every AgentryError in this package flows through `resendError(init)`. No
 * direct `new AgentryError(...)` calls anywhere. This closes the issue
 * Plan J's deferred follow-up #3 surfaced (storage-r2's `networkErr`
 * bypasses `r2Error()`).
 *
 * @module
 */

import { AgentryError, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'email-resend' as const;

export const RESEND_ERROR_CODES = {
  AUTH: 'E_RESEND_AUTH',
  INVALID: 'E_RESEND_INVALID',
  RATE_LIMIT: 'E_RESEND_RATE_LIMIT',
  NETWORK: 'E_RESEND_NETWORK',
  UPSTREAM: 'E_RESEND_UPSTREAM',
} as const;

export type ResendErrorCode = (typeof RESEND_ERROR_CODES)[keyof typeof RESEND_ERROR_CODES];

export interface ResendErrorInit {
  code: ResendErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

/** Construct an AgentryError with this adapter's id pre-filled. All errors emitted from this package go through here. */
export function resendError(init: ResendErrorInit): AgentryError {
  const body: ConstructorParameters<typeof AgentryError>[0] = {
    code: init.code,
    message: init.message,
    phase: init.phase,
    suggestedFix: init.suggestedFix,
    adapter: ADAPTER_ID,
  };
  if (init.context !== undefined) body.context = init.context;
  if (init.cause !== undefined) body.cause = init.cause;
  return new AgentryError(body);
}

/**
 * Map a non-2xx Resend response to an `AgentryError`. Reads the body once
 * (truncates to 500 chars in `context.responseBody`) and extracts
 * `Retry-After` for 429 responses.
 */
export async function httpToResendError(
  response: Response,
  phase: AgentryErrorPhase,
): Promise<AgentryError> {
  const status = response.status;
  let body: string;
  try {
    body = await response.text();
  } catch {
    body = '<unreadable>';
  }
  const truncated = body.length > 500 ? body.slice(0, 500) : body;
  const context: Record<string, unknown> = { status, responseBody: truncated };

  if (status === 401 || status === 403) {
    return resendError({
      code: RESEND_ERROR_CODES.AUTH,
      message: `Resend returned HTTP ${status}: authentication failed`,
      phase,
      suggestedFix:
        'Verify OA_RESEND_API_KEY is set to a valid key from https://resend.com/api-keys. Restricted keys must be granted send permission.',
      context,
    });
  }
  if (status === 422) {
    return resendError({
      code: RESEND_ERROR_CODES.INVALID,
      message: `Resend returned HTTP 422: invalid parameter`,
      phase,
      suggestedFix:
        "Resend rejected the request — typically a malformed `to` address or unverified sending domain. Verify your sending domain at https://resend.com/domains.",
      context,
    });
  }
  if (status === 429) {
    const retryAfterRaw = response.headers.get('Retry-After');
    const retryAfter =
      retryAfterRaw !== null && /^\d+$/.test(retryAfterRaw) ? Number(retryAfterRaw) : undefined;
    if (retryAfter !== undefined) context.retryAfter = retryAfter;
    return resendError({
      code: RESEND_ERROR_CODES.RATE_LIMIT,
      message: `Resend returned HTTP 429: rate-limited`,
      phase,
      suggestedFix:
        'Resend rate-limited the request. Wait `retryAfter` seconds (or back off) before retrying.',
      context,
    });
  }
  if (status >= 500) {
    return resendError({
      code: RESEND_ERROR_CODES.UPSTREAM,
      message: `Resend returned HTTP ${status}: upstream error`,
      phase,
      suggestedFix:
        'Resend returned an unexpected error. Check https://status.resend.com and retry.',
      context,
    });
  }
  // Anything we don't have a specific code for falls through to UPSTREAM.
  return resendError({
    code: RESEND_ERROR_CODES.UPSTREAM,
    message: `Resend returned unexpected HTTP ${status}`,
    phase,
    suggestedFix:
      'Resend returned an unexpected error. Check https://status.resend.com and retry.',
    context,
  });
}

/** Map a thrown `fetch` rejection to an `AgentryError`. */
export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return resendError({
    code: RESEND_ERROR_CODES.NETWORK,
    message: `Network error reaching Resend: ${message}`,
    phase,
    suggestedFix: 'Network error reaching api.resend.com. Verify connectivity and DNS.',
    context: { cause: message },
    cause,
  });
}
