/**
 * @openagentry/adapter-email-resend — public exports + lazy default export
 * resolved from OA_RESEND_* env vars.
 *
 * @module
 */

import type { EmailAdapter, EmailMessage, EmailSendResult } from '@openagentry/core';
import { createResendEmailAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { resendError, RESEND_ERROR_CODES } from './errors.js';

export { createResendEmailAdapter } from './adapter.js';
export {
  parseResendEmailConfig,
  resendEmailConfigSchema,
  type ResendEmailConfig,
  type ResendEmailConfigInput,
} from './config.js';
export {
  ADAPTER_ID,
  RESEND_ERROR_CODES,
  type ResendErrorCode,
} from './errors.js';

let cached: EmailAdapter | undefined;

function buildFromEnv(): EmailAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (result.kind === 'missing') {
    throw resendError({
      code: RESEND_ERROR_CODES.AUTH,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      suggestedFix: `Set ${result.missing.join(', ')} in your environment, or pass a config to createResendEmailAdapter() directly. Get a key at https://resend.com/api-keys.`,
    });
  }
  if (result.kind === 'invalid') {
    const cause = result.error instanceof Error ? result.error.message : String(result.error);
    throw resendError({
      code: RESEND_ERROR_CODES.AUTH,
      message: `OA_RESEND_* env vars failed validation: ${cause}`,
      phase: 'init',
      suggestedFix:
        'Check your env vars match the ResendEmailConfig schema (non-empty apiKey, valid URL for endpoint).',
      cause: result.error,
    });
  }
  cached = createResendEmailAdapter(result.config);
  return cached;
}

const lazyAdapter: EmailAdapter = Object.freeze({
  category: 'email' as const,
  id: 'email-resend',
  send: (message: EmailMessage): Promise<EmailSendResult> => {
    let adapter: EmailAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.send(message);
  },
});

export default lazyAdapter;
