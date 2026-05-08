/**
 * Error codes + helpers for the OpenRouter LLM adapter.
 *
 * Plain HTTP — no SDK to pattern-match against. Status code + body shape
 * drive the dispatch. `isAgentryError` pass-through so already-wrapped
 * errors flow unchanged. **No `instanceof` checks** (cross-realm-safe).
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'llm-openrouter' as const;

export const OPENROUTER_ERROR_CODES = {
  NOT_FOUND: 'E_OPENROUTER_NOT_FOUND',
  AUTH: 'E_OPENROUTER_AUTH',
  RATE_LIMIT: 'E_OPENROUTER_RATE_LIMIT',
  NETWORK: 'E_OPENROUTER_NETWORK',
  UPSTREAM: 'E_OPENROUTER_UPSTREAM',
  CONFIG_INVALID: 'E_OPENROUTER_CONFIG_INVALID',
} as const;

export type OpenrouterErrorCode =
  (typeof OPENROUTER_ERROR_CODES)[keyof typeof OPENROUTER_ERROR_CODES];

export interface OpenrouterErrorInit {
  code: OpenrouterErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export function openrouterError(init: OpenrouterErrorInit): AgentryError {
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

const AUTH_FIX =
  'Verify OA_OPENROUTER_API_KEY is a valid OpenRouter API key. Get one from https://openrouter.ai/keys.';

const NOT_FOUND_FIX =
  'Verify the model id matches an OpenRouter model. Use `listModels()` to enumerate, or check https://openrouter.ai/models.';

const RATE_LIMIT_FIX =
  'Back off and retry. Reduce concurrent requests if persistent.';

const NETWORK_FIX =
  'Check connectivity to openrouter.ai. If running behind a proxy, ensure outbound HTTPS is allowed.';

const UPSTREAM_FIX =
  'OpenRouter or the upstream provider returned an unexpected response. Check https://status.openrouter.ai. Capture err.cause for diagnostics.';

interface ParsedErrorBody {
  code?: string;
  message?: string;
  type?: string;
}

function parseErrorBody(body: string): ParsedErrorBody | undefined {
  if (body.length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const e = (parsed as { error?: unknown }).error;
      if (typeof e === 'object' && e !== null) {
        const out: ParsedErrorBody = {};
        const code = (e as { code?: unknown }).code;
        const message = (e as { message?: unknown }).message;
        const type = (e as { type?: unknown }).type;
        if (typeof code === 'string') out.code = code;
        if (typeof message === 'string') out.message = message;
        if (typeof type === 'string') out.type = type;
        return out;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Map an HTTP `Response` to an AgentryError. Reads body for parse hints. */
export async function httpToOpenrouterError(
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
  const parsed = parseErrorBody(body);

  if (status === 401 || status === 403) {
    return openrouterError({
      code: OPENROUTER_ERROR_CODES.AUTH,
      message: `OpenRouter returned HTTP ${status}: access denied`,
      phase,
      suggestedFix: AUTH_FIX,
      context,
    });
  }

  if (status === 404 || (status === 400 && parsed?.code === 'model_not_found')) {
    return openrouterError({
      code: OPENROUTER_ERROR_CODES.NOT_FOUND,
      message: `OpenRouter returned HTTP ${status}: ${parsed?.message ?? 'resource not found'}`,
      phase,
      suggestedFix: NOT_FOUND_FIX,
      context,
    });
  }

  if (status === 429) {
    const retryAfterRaw = response.headers.get('Retry-After');
    const retryAfter = retryAfterRaw !== null ? Number(retryAfterRaw) : undefined;
    if (retryAfter !== undefined && Number.isFinite(retryAfter)) {
      context.retryAfter = retryAfter;
    }
    return openrouterError({
      code: OPENROUTER_ERROR_CODES.RATE_LIMIT,
      message: 'OpenRouter returned HTTP 429: rate limited',
      phase,
      suggestedFix: RATE_LIMIT_FIX,
      context,
    });
  }

  return openrouterError({
    code: OPENROUTER_ERROR_CODES.UPSTREAM,
    message: `OpenRouter returned HTTP ${status}: ${parsed?.message ?? 'unexpected upstream error'}`,
    phase,
    suggestedFix: UPSTREAM_FIX,
    context,
  });
}

export function networkErr(cause: unknown, phase: AgentryErrorPhase): AgentryError {
  if (isAgentryError(cause)) return cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  const context: Record<string, unknown> = { cause: message };
  return openrouterError({
    code: OPENROUTER_ERROR_CODES.NETWORK,
    message: `Network error reaching OpenRouter: ${message}`,
    phase,
    suggestedFix: NETWORK_FIX,
    context,
    cause,
  });
}
