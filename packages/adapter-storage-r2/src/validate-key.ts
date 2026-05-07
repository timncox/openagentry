/**
 * Key validation. Throws E_R2_INVALID_KEY on shapes that produce surprising
 * S3 behavior or guaranteed bugs.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import { r2Error, R2_ERROR_CODES } from './errors.js';

const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

export function validateKey(key: string, phase: AgentryErrorPhase): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw r2Error({
      code: R2_ERROR_CODES.INVALID_KEY,
      message: 'Storage key must be a non-empty string',
      phase,
      suggestedFix: 'Pass a non-empty string as the key. Keys cannot be empty.',
    });
  }
  if (key.length > 1024) {
    throw r2Error({
      code: R2_ERROR_CODES.INVALID_KEY,
      message: `Storage key is ${key.length} chars, exceeding S3 max of 1024`,
      phase,
      suggestedFix: 'Shorten the key. S3-compatible storage limits keys to 1024 bytes.',
    });
  }
  if (key.startsWith('/')) {
    throw r2Error({
      code: R2_ERROR_CODES.INVALID_KEY,
      message: `Storage key "${key}" starts with "/"; leading slashes produce surprising behavior`,
      phase,
      suggestedFix: 'Remove the leading slash. Use "a/b.txt" instead of "/a/b.txt".',
    });
  }
  if (key.includes('//')) {
    throw r2Error({
      code: R2_ERROR_CODES.INVALID_KEY,
      message: `Storage key "${key}" contains double slashes`,
      phase,
      suggestedFix: 'Remove the double slash. S3 list semantics around "//" are inconsistent across implementations.',
    });
  }
  if (CONTROL_CHAR_RE.test(key)) {
    throw r2Error({
      code: R2_ERROR_CODES.INVALID_KEY,
      message: 'Storage key contains control characters',
      phase,
      suggestedFix: 'Remove control characters from the key. Use printable ASCII or UTF-8 characters only.',
    });
  }
}
