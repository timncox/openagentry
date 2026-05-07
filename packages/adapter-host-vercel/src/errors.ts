/**
 * Error codes + helpers for the Vercel host adapter.
 *
 * Every AgentryError in this package flows through `vercelError(init)`.
 * No direct `new AgentryError(...)` calls anywhere else. Pattern established
 * in Plan K (adapter-email-resend), confirmed in Plans L–M; Plan N follows
 * without deviation.
 *
 * Vercel rate-limit signal: HTTP 429 with `Retry-After` header (seconds).
 * Unlike GitHub (403 + X-RateLimit-Remaining: 0), Vercel's 403 is always
 * a plain permission error.
 *
 * Note: `retryAfter` (seconds until retry) is stored in `context.retryAfter`
 * because `AgentryErrorInit` / `AgentryError` do not yet carry a top-level
 * `retryAfter` field. Callers should read `err.context?.retryAfter`.
 *
 * @module
 */

import { AgentryError, type AgentryErrorInit, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'host-vercel' as const;

/** Stable runtime error codes for the Vercel host adapter. */
export const VERCEL_ERROR_CODES = {
  /** Bad/missing/expired Vercel Personal Access Token. */
  AUTH: 'E_VERCEL_AUTH',
  /**
   * Project, deployment, or domain does not exist at the given identifier.
   * `getEnv` and `exportState` throw this when the project is missing.
   * Callers with `queryableState: true` can probe state before destructive ops.
   */
  NOT_FOUND: 'E_VERCEL_NOT_FOUND',
  /**
   * Token lacks scope to operate on the target (team token without project
   * access, missing `project:write` scope, etc.).
   */
  PERMISSION: 'E_VERCEL_PERMISSION',
  /**
   * Input validation: bad project slug, name conflict on create, malformed
   * request body, missing ConfirmToken on destroyProject, etc.
   */
  INVALID: 'E_VERCEL_INVALID',
  /**
   * HTTP 429 rate limit hit. `context.retryAfter` (seconds) is populated from
   * the `Retry-After` response header. Defaults to 60 if header is absent.
   */
  RATE_LIMIT: 'E_VERCEL_RATE_LIMIT',
  /** fetch-level failure: DNS, TCP, abort, timeout. */
  NETWORK: 'E_VERCEL_NETWORK',
  /** HTTP 5xx or any other unmapped Vercel error response. */
  UPSTREAM: 'E_VERCEL_UPSTREAM',
  /**
   * Project has no git link configured in Vercel — `deploy` cannot create a
   * deployment from gitSource. Caller should connect the project to a git
   * repository via the Vercel dashboard and retry.
   */
  NO_GIT_LINK: 'E_VERCEL_NO_GIT_LINK',
  /**
   * State-bundle schema mismatch on `importState`: wrong version, missing
   * required fields, or corrupted bundle. The import is aborted before any
   * mutation.
   */
  BAD_STATE: 'E_VERCEL_BAD_STATE',
  /**
   * Transient code thrown only by `parseVercelHostConfig()` when zod rejects
   * the input shape. Never appears during method calls on a live adapter.
   */
  SCHEMA: 'E_VERCEL_SCHEMA',
} as const;

export type VercelErrorCode = (typeof VERCEL_ERROR_CODES)[keyof typeof VERCEL_ERROR_CODES];

/** Construct an AgentryError with this adapter's id pre-filled. */
export function vercelError(init: AgentryErrorInit): AgentryError {
  return new AgentryError({
    ...init,
    adapter: ADAPTER_ID,
  });
}

/**
 * Map a non-2xx HTTP response to an AgentryError.
 *
 * Vercel error responses are JSON of shape:
 *   `{ error: { code: string, message: string } }`
 * We pass `error.message` to `context.vercelErrorMessage` and `error.code`
 * to `context.vercelErrorCode` when present.
 *
 * Rate-limit mapping:
 * - HTTP 429 → RATE_LIMIT; `context.retryAfter` from `Retry-After` header (seconds).
 *   Defaults to 60 if header is absent or unparseable.
 *
 * Vercel does NOT use 403 for rate limits (unlike GitHub). A 403 from Vercel
 * is always a plain PERMISSION error.
 *
 * @param status   The HTTP status code from the Vercel response.
 * @param body     The parsed JSON body, or null when absent/unparseable.
 * @param headers  The response headers map (lowercase key names).
 * @param phase    The AgentryErrorPhase at which this error occurred.
 */
export function httpToVercelError(
  status: number,
  body: { error?: { code?: string; message?: string } } | null,
  headers: Record<string, string | null>,
  phase: AgentryErrorPhase,
): AgentryError {
  const vercelErrorMessage = body?.error?.message ?? undefined;
  const vercelErrorCode = body?.error?.code ?? undefined;
  const baseContext: Record<string, unknown> = {
    httpStatus: status,
    ...(vercelErrorMessage !== undefined ? { vercelErrorMessage } : {}),
    ...(vercelErrorCode !== undefined ? { vercelErrorCode } : {}),
  };

  // ---------- 401 → AUTH ----------
  if (status === 401) {
    return vercelError({
      code: VERCEL_ERROR_CODES.AUTH,
      message: `Vercel returned HTTP 401: authentication failed`,
      phase,
      suggestedFix:
        'Verify OA_VERCEL_TOKEN is set to a valid Vercel Personal Access Token. ' +
        'Generate a token at https://vercel.com/account/tokens with appropriate scopes. ' +
        'If using OA_VERCEL_TEAM_ID, confirm the token has access to that team.',
      context: baseContext,
    });
  }

  // ---------- 403 → PERMISSION (Vercel never uses 403 for rate limits) ----------
  if (status === 403) {
    return vercelError({
      code: VERCEL_ERROR_CODES.PERMISSION,
      message: `Vercel returned HTTP 403: permission denied`,
      phase,
      suggestedFix:
        'The token does not have permission to perform this operation. ' +
        'Verify the token has the required scopes for the target project and team. ' +
        'If OA_VERCEL_TEAM_ID is set, confirm the token has team-level access.',
      context: baseContext,
    });
  }

  // ---------- 429 → RATE_LIMIT ----------
  if (status === 429) {
    const retryAfterHeader = headers['retry-after'];
    let retryAfter = 60;
    if (retryAfterHeader !== null && retryAfterHeader !== undefined) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
    }
    return vercelError({
      code: VERCEL_ERROR_CODES.RATE_LIMIT,
      message: `Vercel rate limit exceeded (HTTP 429)`,
      phase,
      suggestedFix:
        `Rate limit hit. Retry after ${retryAfter} seconds. ` +
        'Reduce request frequency. See https://vercel.com/docs/rest-api#rate-limiting for limits.',
      context: { ...baseContext, retryAfter },
    });
  }

  // ---------- 404 → NOT_FOUND ----------
  if (status === 404) {
    return vercelError({
      code: VERCEL_ERROR_CODES.NOT_FOUND,
      message: `Vercel returned HTTP 404: resource not found`,
      phase,
      suggestedFix:
        'The project, deployment, or domain was not found. ' +
        'Verify the project name or ID is correct and the resource exists in your Vercel account.',
      context: baseContext,
    });
  }

  // ---------- 400 / 422 → INVALID ----------
  if (status === 400 || status === 422) {
    return vercelError({
      code: VERCEL_ERROR_CODES.INVALID,
      message: `Vercel returned HTTP ${status}: ${vercelErrorMessage ?? 'validation failed'}`,
      phase,
      suggestedFix:
        'Vercel rejected the request as invalid. ' +
        'Check the project name (URL-safe alphanumeric + hyphens), domain format, and request body. ' +
        'Inspect context.vercelErrorMessage for the specific rejection reason.',
      context: baseContext,
    });
  }

  // ---------- 5xx → UPSTREAM ----------
  if (status >= 500) {
    return vercelError({
      code: VERCEL_ERROR_CODES.UPSTREAM,
      message: `Vercel returned HTTP ${status}: upstream server error`,
      phase,
      suggestedFix:
        'Vercel returned a server error. Check https://www.vercel-status.com/ and retry.',
      context: baseContext,
    });
  }

  // ---------- other 4xx → UPSTREAM (unexpected; surface for debugging) ----------
  return vercelError({
    code: VERCEL_ERROR_CODES.UPSTREAM,
    message: `Vercel returned unexpected HTTP ${status}`,
    phase,
    suggestedFix:
      'Vercel returned an unexpected status code. Inspect context.httpStatus and context.vercelErrorMessage for details.',
    context: baseContext,
  });
}

/**
 * Map a thrown `fetch` rejection (network-level failure) to an AgentryError
 * with code NETWORK. Routes through `vercelError` — does NOT call
 * `new AgentryError(...)` directly (closes Plan J deferred follow-up #3,
 * carried through Plans K–M into Plan N).
 */
export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return vercelError({
    code: VERCEL_ERROR_CODES.NETWORK,
    message: `Network error reaching Vercel API: ${message}`,
    phase,
    suggestedFix:
      'A network-level error prevented the request from reaching api.vercel.com (or the configured OA_VERCEL_ENDPOINT). ' +
      'Verify connectivity and DNS resolution.',
    context: { cause: message },
    cause,
  });
}
