/**
 * Error codes + helpers for the R2 storage adapter.
 *
 * @module
 */

import { AgentryError, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'storage-r2' as const;

export const R2_ERROR_CODES = {
  NOT_FOUND: 'E_R2_NOT_FOUND',
  PERMISSION: 'E_R2_PERMISSION',
  INVALID_KEY: 'E_R2_INVALID_KEY',
  NETWORK: 'E_R2_NETWORK',
  PUBLIC_NOT_CONFIGURED: 'E_R2_PUBLIC_NOT_CONFIGURED',
  UPSTREAM: 'E_R2_UPSTREAM',
  /** Thrown at init time when env vars are missing or fail schema validation. */
  CONFIG_INVALID: 'E_R2_CONFIG_INVALID',
} as const;

export type R2ErrorCode = (typeof R2_ERROR_CODES)[keyof typeof R2_ERROR_CODES];

export interface R2ErrorInit {
  code: R2ErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export function r2Error(init: R2ErrorInit): AgentryError {
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

export async function httpToR2Error(
  response: Response,
  phase: AgentryErrorPhase,
  key: string | undefined,
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
  if (key !== undefined) context.key = key;

  if (status === 401 || status === 403) {
    return r2Error({
      code: R2_ERROR_CODES.PERMISSION,
      message: `R2 returned HTTP ${status}: access denied`,
      phase,
      suggestedFix:
        'Check your R2 access key has the bucket-scoped "Object Read & Write" permission and the bucket name is correct.',
      context,
    });
  }
  if (status === 404) {
    return r2Error({
      code: R2_ERROR_CODES.NOT_FOUND,
      message: `R2 returned HTTP 404: object not found${key !== undefined ? ` ("${key}")` : ''}`,
      phase,
      suggestedFix: 'Verify the key exists. Use list(prefix) to enumerate.',
      context,
    });
  }
  return r2Error({
    code: R2_ERROR_CODES.UPSTREAM,
    message: `R2 returned HTTP ${status}: unexpected upstream error`,
    phase,
    suggestedFix:
      'R2 returned an unexpected error. Check the R2 status page and retry; persistent failures may indicate account-level issues.',
    context,
  });
}

export function networkErr(cause: unknown, phase: AgentryErrorPhase, key: string | undefined): AgentryError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const context: Record<string, unknown> = { cause: message };
  if (key !== undefined) context.key = key;
  const body: ConstructorParameters<typeof AgentryError>[0] = {
    code: R2_ERROR_CODES.NETWORK,
    message: `Network error reaching R2: ${message}`,
    phase,
    suggestedFix:
      "Check connectivity to your R2 endpoint. If running on Cloudflare Workers, confirm the endpoint isn't internal-only.",
    adapter: ADAPTER_ID,
    context,
  };
  if (cause !== undefined) body.cause = cause;
  return new AgentryError(body);
}
