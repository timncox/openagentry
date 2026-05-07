/**
 * Error codes + helpers for the GitHub repo adapter.
 *
 * Every AgentryError in this package flows through `githubError(init)`.
 * No direct `new AgentryError(...)` calls anywhere else. Pattern established
 * in Plan K (adapter-email-resend) and confirmed correct in Plan L
 * (adapter-domain-namecheap). Plan M carries it forward unchanged.
 *
 * Note: `retryAfter` (seconds until retry) is stored in `context.retryAfter`
 * because `AgentryErrorInit` / `AgentryError` do not yet carry a top-level
 * `retryAfter` field. Callers should read `err.context?.retryAfter`.
 *
 * @module
 */

import { AgentryError, type AgentryErrorInit, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'repo-github' as const;

/** Stable runtime error codes for the GitHub repo adapter. */
export const GITHUB_ERROR_CODES = {
  /** Bad token, expired token, missing token, suspended account. */
  AUTH: 'E_GITHUB_AUTH',
  /**
   * Repo does not exist. Thrown by `delete` against a missing repo and similar
   * ops. `get` returns `null` for 404 instead of throwing — callers who need
   * to distinguish should use `get` first (`queryableState: true`).
   */
  NOT_FOUND: 'E_GITHUB_NOT_FOUND',
  /** Token lacks scope to operate on the target (org admin, fine-grained perms). */
  PERMISSION: 'E_GITHUB_PERMISSION',
  /**
   * Input validation: bad repo name, unsupported visibility, ConfirmToken
   * missing on delete, name conflict on create (GitHub 422 for "name already
   * exists" — callers can inspect `context.githubErrorMessage` to detect this).
   */
  INVALID: 'E_GITHUB_INVALID',
  /**
   * Primary or secondary rate limit hit. `context.retryAfter` (seconds) is
   * populated from `Retry-After` header or computed from `X-RateLimit-Reset`
   * epoch.
   */
  RATE_LIMIT: 'E_GITHUB_RATE_LIMIT',
  /** fetch-level failure: DNS, TCP, abort, timeout. */
  NETWORK: 'E_GITHUB_NETWORK',
  /** HTTP 5xx or any unmapped GitHub error response. */
  UPSTREAM: 'E_GITHUB_UPSTREAM',
  /**
   * Transient code thrown only by `parseGithubRepoConfig()` when zod rejects
   * the input shape. Never appears during method calls on a live adapter.
   */
  SCHEMA: 'E_GITHUB_SCHEMA',
} as const;

export type GithubErrorCode = (typeof GITHUB_ERROR_CODES)[keyof typeof GITHUB_ERROR_CODES];

/** Construct an AgentryError with this adapter's id pre-filled. */
export function githubError(init: AgentryErrorInit): AgentryError {
  return new AgentryError({
    ...init,
    adapter: ADAPTER_ID,
  });
}

/**
 * Map a non-2xx HTTP response to an AgentryError.
 *
 * GitHub error responses are JSON of shape:
 *   `{ message: string, errors?: [...], documentation_url?: string }`
 * We pass `message` through to `context.githubErrorMessage` and `errors`
 * (if present) to `context.githubErrors`.
 *
 * Rate-limit detection:
 * - Primary rate limit:   HTTP 403 + `X-RateLimit-Remaining: 0`
 *   context.retryAfter = seconds until X-RateLimit-Reset epoch (or 60 if absent)
 * - Secondary rate limit: HTTP 403 + body.message starts with
 *   "You have exceeded a secondary rate limit"
 *   context.retryAfter = Retry-After header in seconds (or 60 if absent)
 *
 * @param httpStatus  The HTTP status code from the GitHub response.
 * @param body        The parsed JSON body (or null when body is absent/unparseable).
 * @param headers     The response headers map.
 * @param phase       The AgentryErrorPhase at which this error occurred.
 */
export function httpToGithubError(
  httpStatus: number,
  body: { message?: string; errors?: unknown[] } | null,
  headers: Record<string, string | null>,
  phase: AgentryErrorPhase,
): AgentryError {
  const githubErrorMessage = body?.message ?? undefined;
  const githubErrors = body?.errors ?? undefined;
  const baseContext: Record<string, unknown> = {
    httpStatus,
    ...(githubErrorMessage !== undefined ? { githubErrorMessage } : {}),
    ...(githubErrors !== undefined ? { githubErrors } : {}),
  };

  // ---------- 401 → AUTH ----------
  if (httpStatus === 401) {
    return githubError({
      code: GITHUB_ERROR_CODES.AUTH,
      message: `GitHub returned HTTP 401: authentication failed`,
      phase,
      suggestedFix:
        'Verify OA_GITHUB_TOKEN is set to a valid Personal Access Token with the required scopes. ' +
        'Classic PATs need the `repo` scope; fine-grained PATs need "Administration: Read and write" + "Metadata: Read-only".',
      context: baseContext,
    });
  }

  // ---------- 403 — distinguish rate-limit from permission ----------
  if (httpStatus === 403) {
    const rateLimitRemaining = headers['x-ratelimit-remaining'];
    const isPrimaryRateLimit = rateLimitRemaining === '0';

    const isSecondaryRateLimit =
      !isPrimaryRateLimit &&
      typeof githubErrorMessage === 'string' &&
      githubErrorMessage.startsWith('You have exceeded a secondary rate limit');

    if (isPrimaryRateLimit) {
      const resetEpoch = headers['x-ratelimit-reset'];
      let retryAfter = 60;
      if (resetEpoch !== null && resetEpoch !== undefined) {
        const resetSecs = parseInt(resetEpoch, 10);
        if (!isNaN(resetSecs)) {
          const nowSecs = Math.floor(Date.now() / 1000);
          retryAfter = Math.max(0, resetSecs - nowSecs);
        }
      }
      return githubError({
        code: GITHUB_ERROR_CODES.RATE_LIMIT,
        message: `GitHub primary rate limit exceeded`,
        phase,
        suggestedFix:
          `Rate limit exhausted. Retry after ${retryAfter} seconds. ` +
          'Check https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api for limits.',
        context: { ...baseContext, rateLimitRemaining: '0', retryAfter },
      });
    }

    if (isSecondaryRateLimit) {
      const retryAfterHeader = headers['retry-after'];
      let retryAfter = 60;
      if (retryAfterHeader !== null && retryAfterHeader !== undefined) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
      }
      return githubError({
        code: GITHUB_ERROR_CODES.RATE_LIMIT,
        message: `GitHub secondary rate limit exceeded`,
        phase,
        suggestedFix:
          `Secondary rate limit hit. Retry after ${retryAfter} seconds. ` +
          'Reduce request concurrency or frequency. See https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits.',
        context: { ...baseContext, retryAfter },
      });
    }

    // Plain 403 → PERMISSION
    return githubError({
      code: GITHUB_ERROR_CODES.PERMISSION,
      message: `GitHub returned HTTP 403: permission denied`,
      phase,
      suggestedFix:
        'The token does not have permission to perform this operation. ' +
        'For org repos, ensure the token has org-level admin rights. ' +
        'For fine-grained PATs, verify "Administration: Read and write" is granted for the target repo.',
      context: baseContext,
    });
  }

  // ---------- 404 → NOT_FOUND ----------
  if (httpStatus === 404) {
    return githubError({
      code: GITHUB_ERROR_CODES.NOT_FOUND,
      message: `GitHub returned HTTP 404: resource not found`,
      phase,
      suggestedFix:
        'The repository or resource was not found. ' +
        'Verify the owner and repo name are correct. ' +
        'Private repos are 404 (not 403) when the token lacks access.',
      context: baseContext,
    });
  }

  // ---------- 422 → INVALID ----------
  if (httpStatus === 422) {
    return githubError({
      code: GITHUB_ERROR_CODES.INVALID,
      message: `GitHub returned HTTP 422: ${githubErrorMessage ?? 'validation failed'}`,
      phase,
      suggestedFix:
        'GitHub rejected the request as invalid. ' +
        'Check the repo name (alphanumeric, hyphens, underscores, periods only), visibility value, ' +
        'and that the repo name is not already taken. ' +
        'Inspect context.githubErrorMessage and context.githubErrors for details.',
      context: baseContext,
    });
  }

  // ---------- 5xx → UPSTREAM ----------
  if (httpStatus >= 500) {
    return githubError({
      code: GITHUB_ERROR_CODES.UPSTREAM,
      message: `GitHub returned HTTP ${httpStatus}: upstream server error`,
      phase,
      suggestedFix:
        'GitHub returned a server error. Check https://www.githubstatus.com/ and retry.',
      context: baseContext,
    });
  }

  // ---------- other 4xx → UPSTREAM (unexpected; surface for debugging) ----------
  return githubError({
    code: GITHUB_ERROR_CODES.UPSTREAM,
    message: `GitHub returned unexpected HTTP ${httpStatus}`,
    phase,
    suggestedFix:
      'GitHub returned an unexpected status. Inspect context.httpStatus and context.githubErrorMessage for details.',
    context: baseContext,
  });
}

/**
 * Map a thrown `fetch` rejection (network-level failure) to an AgentryError
 * with code NETWORK. Routes through `githubError` — does NOT call
 * `new AgentryError(...)` directly (closes Plan J deferred follow-up #3,
 * carried through Plans K and L).
 */
export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return githubError({
    code: GITHUB_ERROR_CODES.NETWORK,
    message: `Network error reaching GitHub API: ${message}`,
    phase,
    suggestedFix:
      'A network-level error prevented the request from reaching api.github.com (or your GHE Server endpoint). ' +
      'Verify connectivity and DNS resolution. Check OA_GITHUB_ENDPOINT if using GitHub Enterprise Server.',
    context: { cause: message },
    cause,
  });
}
