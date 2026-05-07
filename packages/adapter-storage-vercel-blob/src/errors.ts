/**
 * Error codes + helpers for the Vercel Blob storage adapter.
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobError,
  BlobFileTooLargeError,
  BlobNotFoundError,
  BlobPathnameMismatchError,
  BlobPreconditionFailedError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
} from '@vercel/blob';

export const ADAPTER_ID = 'storage-vercel-blob' as const;

export const VERCEL_BLOB_ERROR_CODES = {
  NOT_FOUND: 'E_VERCEL_BLOB_NOT_FOUND',
  PERMISSION: 'E_VERCEL_BLOB_PERMISSION',
  INVALID_KEY: 'E_VERCEL_BLOB_INVALID_KEY',
  NETWORK: 'E_VERCEL_BLOB_NETWORK',
  UPSTREAM: 'E_VERCEL_BLOB_UPSTREAM',
  /** Init-time error when env vars are missing or fail schema validation. */
  CONFIG_INVALID: 'E_VERCEL_BLOB_CONFIG_INVALID',
} as const;

export type VercelBlobErrorCode =
  (typeof VERCEL_BLOB_ERROR_CODES)[keyof typeof VERCEL_BLOB_ERROR_CODES];

export interface VercelBlobErrorInit {
  code: VercelBlobErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export function vercelBlobError(init: VercelBlobErrorInit): AgentryError {
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

/**
 * Map a thrown SDK error to an AgentryError. Order matters:
 *   1. Already-wrapped AgentryError → pass through (cross-realm-safe).
 *   2. Specific SDK subclasses (most specific first).
 *   3. Network heuristics (TypeError + Error message hints).
 *   4. Generic BlobError parent → UPSTREAM.
 *   5. Catch-all → UPSTREAM.
 */
export function sdkErrorToBlobError(
  err: unknown,
  phase: AgentryErrorPhase,
  key: string | undefined,
): AgentryError {
  if (isAgentryError(err)) return err;

  const context: Record<string, unknown> = {};
  if (key !== undefined) context.key = key;
  if (err instanceof Error) context.cause = err.message;

  if (err instanceof BlobNotFoundError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.NOT_FOUND,
      message: `Vercel Blob: object not found${key !== undefined ? ` ("${key}")` : ''}`,
      phase,
      suggestedFix: 'Verify the pathname exists. Use `list(prefix)` to enumerate.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobAccessError || err instanceof BlobClientTokenExpiredError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.PERMISSION,
      message: `Vercel Blob: access denied${key !== undefined ? ` for "${key}"` : ''}`,
      phase,
      suggestedFix:
        'Check that OA_VERCEL_BLOB_TOKEN is a valid read-write token for the target store. If you copied it manually, re-pull from Vercel via `vercel env pull`.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobStoreNotFoundError || err instanceof BlobStoreSuspendedError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: `Vercel Blob: store unavailable (${err.constructor.name})`,
      phase,
      suggestedFix:
        'Check the Vercel dashboard — the blob store may be deleted, suspended, or moved to another team. Verify OA_VERCEL_BLOB_TOKEN is scoped to the right store.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobServiceRateLimited) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: `Vercel Blob: rate limited (retry after ${err.retryAfter}s)`,
      phase,
      suggestedFix: `Back off and retry after ${err.retryAfter} seconds. Reduce request rate if persistent.`,
      context: { ...context, retryAfter: err.retryAfter },
      cause: err,
    });
  }
  if (err instanceof BlobServiceNotAvailable) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: 'Vercel Blob: service unavailable',
      phase,
      suggestedFix:
        'The Vercel Blob service is temporarily unavailable. Retry with backoff; check the Vercel status page for incidents.',
      context,
      cause: err,
    });
  }
  if (
    err instanceof BlobContentTypeNotAllowedError ||
    err instanceof BlobFileTooLargeError ||
    err instanceof BlobPathnameMismatchError ||
    err instanceof BlobPreconditionFailedError
  ) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: `Vercel Blob: ${(err as Error).message || err.constructor.name}`,
      phase,
      suggestedFix:
        'Vercel rejected the request based on store-side constraints. Check the error message for the specific reason; this is usually a configuration mismatch.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobRequestAbortedError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.NETWORK,
      message: 'Vercel Blob: request aborted',
      phase,
      suggestedFix:
        'The request was aborted. If you passed an AbortSignal, this is expected; otherwise retry.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobUnknownError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: 'Vercel Blob: unknown error from upstream',
      phase,
      suggestedFix:
        'Vercel Blob returned an unrecognized error. Check the Vercel status page; capture err.cause for diagnostics.',
      context,
      cause: err,
    });
  }
  if (looksLikeNetworkError(err)) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.NETWORK,
      message: `Network error reaching Vercel Blob: ${err instanceof Error ? err.message : String(err)}`,
      phase,
      suggestedFix:
        'Check connectivity to https://blob.vercel-storage.com. If running behind a proxy, ensure outbound HTTPS is allowed.',
      context,
      cause: err,
    });
  }
  if (err instanceof BlobError) {
    return vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
      message: `Vercel Blob returned an error: ${err.message}`,
      phase,
      suggestedFix:
        'Vercel Blob returned an unexpected error. Check the Vercel status page and your store status.',
      context,
      cause: err,
    });
  }

  // Catch-all
  return vercelBlobError({
    code: VERCEL_BLOB_ERROR_CODES.UPSTREAM,
    message: `Unexpected error from @vercel/blob: ${err instanceof Error ? err.message : String(err)}`,
    phase,
    suggestedFix:
      'An unrecognized error class was thrown. Capture err.cause and check the Vercel Blob SDK CHANGELOG for new error types.',
    context,
    cause: err,
  });
}
