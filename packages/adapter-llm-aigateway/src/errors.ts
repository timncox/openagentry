/**
 * Error codes + helpers for the AI Gateway LLM adapter.
 *
 * SDK error classes are checked structurally (by name property) rather than
 * `instanceof` because the `ai` SDK's class identity may not survive cross-realm
 * boundaries (worker threads, vm sandboxes, multiple installs in monorepos).
 *
 * Order of dispatch in `sdkErrorToAigatewayError`:
 *   1. Already-wrapped AgentryError → pass through.
 *   2. Gateway-specific class names (most specific first; `@ai-sdk/gateway`).
 *   3. Generic `LoadAPIKeyError` → AUTH.
 *   4. `APICallError` with statusCode dispatch.
 *   5. Network heuristics (TypeError + Error message hints).
 *   6. Catch-all → UPSTREAM.
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'llm-aigateway' as const;

export const AIGATEWAY_ERROR_CODES = {
  NOT_FOUND: 'E_AIGATEWAY_NOT_FOUND',
  AUTH: 'E_AIGATEWAY_AUTH',
  RATE_LIMIT: 'E_AIGATEWAY_RATE_LIMIT',
  NETWORK: 'E_AIGATEWAY_NETWORK',
  UPSTREAM: 'E_AIGATEWAY_UPSTREAM',
  CONFIG_INVALID: 'E_AIGATEWAY_CONFIG_INVALID',
} as const;

export type AigatewayErrorCode =
  (typeof AIGATEWAY_ERROR_CODES)[keyof typeof AIGATEWAY_ERROR_CODES];

export interface AigatewayErrorInit {
  code: AigatewayErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export function aigatewayError(init: AigatewayErrorInit): AgentryError {
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

const NETWORK_ERROR_HINTS = [
  'fetch failed',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'AbortError',
  'NetworkError',
];

function looksLikeNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return NETWORK_ERROR_HINTS.some((hint) => msg.includes(hint));
}

function errName(err: unknown): string {
  if (err instanceof Error && typeof err.name === 'string') return err.name;
  if (typeof err === 'object' && err !== null && 'constructor' in err) {
    const c = (err as { constructor?: { name?: string } }).constructor;
    if (c?.name) return c.name;
  }
  return '';
}

function statusCodeOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const sc = (err as { statusCode?: unknown }).statusCode;
    if (typeof sc === 'number') return sc;
  }
  return undefined;
}

const AUTH_FIX =
  'Verify OA_AIGATEWAY_API_KEY is a valid Vercel AI Gateway key. Pull from Vercel via `vercel env pull` or copy from the dashboard.';

const NOT_FOUND_FIX =
  'Verify the model id is supported by Vercel AI Gateway. Use `listModels()` to enumerate.';

const RATE_LIMIT_FIX =
  'Back off and retry. Reduce concurrent requests if persistent.';

const NETWORK_FIX =
  'Check connectivity to ai-gateway.vercel.sh. If running behind a proxy, ensure outbound HTTPS is allowed.';

const UPSTREAM_FIX =
  'Check the Vercel status page; capture err.cause for diagnostics.';

/** Map an HTTP `Response` (from listModels plain-fetch path) to an AgentryError. */
export async function httpToAigatewayError(
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
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.AUTH,
      message: `AI Gateway returned HTTP ${status}: access denied`,
      phase,
      suggestedFix: AUTH_FIX,
      context,
    });
  }
  if (status === 404) {
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.NOT_FOUND,
      message: 'AI Gateway returned HTTP 404',
      phase,
      suggestedFix: 'Verify the resource (model id, endpoint) exists.',
      context,
    });
  }
  if (status === 429) {
    const retryAfterRaw = response.headers.get('Retry-After');
    const retryAfter = retryAfterRaw !== null ? Number(retryAfterRaw) : undefined;
    if (retryAfter !== undefined && Number.isFinite(retryAfter)) {
      context.retryAfter = retryAfter;
    }
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.RATE_LIMIT,
      message: 'AI Gateway returned HTTP 429: rate limited',
      phase,
      suggestedFix: RATE_LIMIT_FIX,
      context,
    });
  }
  return aigatewayError({
    code: AIGATEWAY_ERROR_CODES.UPSTREAM,
    message: `AI Gateway returned HTTP ${status}: unexpected upstream error`,
    phase,
    suggestedFix: UPSTREAM_FIX,
    context,
  });
}

export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const context: Record<string, unknown> = { cause: message };
  return aigatewayError({
    code: AIGATEWAY_ERROR_CODES.NETWORK,
    message: `Network error reaching AI Gateway: ${message}`,
    phase,
    suggestedFix: NETWORK_FIX,
    context,
    cause,
  });
}

const AUTH_ERROR_NAMES = new Set([
  'GatewayAuthenticationError',
  'LoadAPIKeyError',
]);

const NOT_FOUND_ERROR_NAMES = new Set([
  'GatewayModelNotFoundError',
]);

const RATE_LIMIT_ERROR_NAMES = new Set([
  'GatewayRateLimitError',
]);

const UPSTREAM_GATEWAY_ERROR_NAMES = new Set([
  'GatewayInvalidRequestError',
  'GatewayInternalServerError',
  'GatewayResponseError',
  'GatewayError',
]);

function retryAfterOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const anyErr = err as {
    retryAfter?: unknown;
    responseHeaders?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
  if (typeof anyErr.retryAfter === 'number') return anyErr.retryAfter;
  const ra =
    (anyErr.responseHeaders?.['retry-after']) ??
    (anyErr.headers?.['retry-after']);
  if (typeof ra === 'string' || typeof ra === 'number') {
    const n = Number(ra);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function sdkErrorToAigatewayError(
  err: unknown,
  phase: AgentryErrorPhase,
): AgentryError {
  if (isAgentryError(err)) return err;

  const name = errName(err);
  const message = err instanceof Error ? err.message : String(err);
  const context: Record<string, unknown> = {};
  if (err instanceof Error) context.cause = err.message;

  if (AUTH_ERROR_NAMES.has(name)) {
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.AUTH,
      message: `AI Gateway auth error (${name}): ${message}`,
      phase,
      suggestedFix: AUTH_FIX,
      context,
      cause: err,
    });
  }

  if (NOT_FOUND_ERROR_NAMES.has(name)) {
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.NOT_FOUND,
      message: `AI Gateway model not found (${name}): ${message}`,
      phase,
      suggestedFix: NOT_FOUND_FIX,
      context,
      cause: err,
    });
  }

  if (RATE_LIMIT_ERROR_NAMES.has(name)) {
    const retryAfter = retryAfterOf(err);
    const ctx = retryAfter !== undefined ? { ...context, retryAfter } : context;
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.RATE_LIMIT,
      message: `AI Gateway rate limited (${name}): ${message}`,
      phase,
      suggestedFix: RATE_LIMIT_FIX,
      context: ctx,
      cause: err,
    });
  }

  if (UPSTREAM_GATEWAY_ERROR_NAMES.has(name)) {
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.UPSTREAM,
      message: `AI Gateway upstream error (${name}): ${message}`,
      phase,
      suggestedFix: UPSTREAM_FIX,
      context,
      cause: err,
    });
  }

  if (name === 'APICallError') {
    const status = statusCodeOf(err);
    if (status === 401 || status === 403) {
      return aigatewayError({
        code: AIGATEWAY_ERROR_CODES.AUTH,
        message: `AI Gateway auth error (HTTP ${status}): ${message}`,
        phase,
        suggestedFix: AUTH_FIX,
        context: { ...context, status },
        cause: err,
      });
    }
    if (status === 404) {
      return aigatewayError({
        code: AIGATEWAY_ERROR_CODES.NOT_FOUND,
        message: `AI Gateway not found (HTTP 404): ${message}`,
        phase,
        suggestedFix: NOT_FOUND_FIX,
        context: { ...context, status },
        cause: err,
      });
    }
    if (status === 429) {
      const retryAfter = retryAfterOf(err);
      const ctx =
        retryAfter !== undefined
          ? { ...context, status, retryAfter }
          : { ...context, status };
      return aigatewayError({
        code: AIGATEWAY_ERROR_CODES.RATE_LIMIT,
        message: `AI Gateway rate limited (HTTP 429): ${message}`,
        phase,
        suggestedFix: RATE_LIMIT_FIX,
        context: ctx,
        cause: err,
      });
    }
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.UPSTREAM,
      message: `AI Gateway upstream error${status !== undefined ? ` (HTTP ${status})` : ''}: ${message}`,
      phase,
      suggestedFix: UPSTREAM_FIX,
      context: status !== undefined ? { ...context, status } : context,
      cause: err,
    });
  }

  if (looksLikeNetworkError(err)) {
    return aigatewayError({
      code: AIGATEWAY_ERROR_CODES.NETWORK,
      message: `Network error reaching AI Gateway: ${message}`,
      phase,
      suggestedFix: NETWORK_FIX,
      context,
      cause: err,
    });
  }

  return aigatewayError({
    code: AIGATEWAY_ERROR_CODES.UPSTREAM,
    message: `Unexpected error from ai SDK: ${message}`,
    phase,
    suggestedFix:
      'An unrecognized error class was thrown. Capture err.cause and check the AI SDK CHANGELOG for new error types.',
    context,
    cause: err,
  });
}
