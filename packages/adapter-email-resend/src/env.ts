/**
 * Read Resend adapter configuration from environment variables.
 *
 * @module
 */

import { parseResendEmailConfig, type ResendEmailConfig } from './config.js';

const REQUIRED = ['OA_RESEND_API_KEY'] as const;

export type EnvReadResult =
  | { kind: 'ok'; config: ResendEmailConfig }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'invalid'; error: unknown };

export function readEnvConfig(env: Record<string, string | undefined>): EnvReadResult {
  const missing = REQUIRED.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    return { kind: 'missing', missing };
  }
  try {
    const input: Record<string, unknown> = {
      apiKey: env.OA_RESEND_API_KEY!,
    };
    if (env.OA_RESEND_ENDPOINT !== undefined && env.OA_RESEND_ENDPOINT !== '') {
      input.endpoint = env.OA_RESEND_ENDPOINT;
    }
    const config = parseResendEmailConfig(input);
    return { kind: 'ok', config };
  } catch (err) {
    return { kind: 'invalid', error: err };
  }
}
