/**
 * Pathname validation + Cache-Control parsing helpers.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import { vercelBlobError, VERCEL_BLOB_ERROR_CODES } from './errors.js';

export function validateKey(key: string, phase: AgentryErrorPhase): void {
  if (key === '') {
    throw vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.INVALID_KEY,
      message: 'Vercel Blob pathname must not be empty.',
      phase,
      suggestedFix: 'Use a non-empty pathname (e.g., "uploads/avatar.png").',
    });
  }
  if (key.startsWith('/')) {
    throw vercelBlobError({
      code: VERCEL_BLOB_ERROR_CODES.INVALID_KEY,
      message: `Vercel Blob pathname must not start with "/" (got ${JSON.stringify(key)}).`,
      phase,
      suggestedFix: 'Pathnames are relative to the store root — drop the leading slash.',
    });
  }
}

/**
 * Extract the `max-age=N` directive from a Cache-Control header string.
 * Returns `undefined` if the header is undefined, contains no `max-age`,
 * or the value isn't a non-negative integer.
 *
 * Note: `s-maxage` is intentionally NOT matched — this helper is for the
 * single-tenant edge cache value Vercel Blob exposes as `cacheControlMaxAge`.
 */
export function parseCacheMaxAge(headerValue: string | undefined): number | undefined {
  if (headerValue === undefined) return undefined;
  const match = headerValue.match(/(?:^|[,\s])max-age=(\d+)/i);
  if (match === null) return undefined;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds;
}
