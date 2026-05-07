/**
 * Zod-validated configuration for the Resend email adapter.
 *
 * @module
 */

import { z } from 'zod';

export const resendEmailConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1, 'apiKey must be a non-empty string'),
    endpoint: z.string().url().optional(),
  })
  .strict();

export type ResendEmailConfigInput = z.input<typeof resendEmailConfigSchema>;
export type ResendEmailConfigParsed = z.output<typeof resendEmailConfigSchema>;

export interface ResendEmailConfig
  extends Required<Pick<ResendEmailConfigParsed, 'apiKey' | 'endpoint'>> {}

export function parseResendEmailConfig(input: unknown): ResendEmailConfig {
  const parsed = resendEmailConfigSchema.parse(input);
  return {
    apiKey: parsed.apiKey,
    endpoint: parsed.endpoint ?? 'https://api.resend.com',
  };
}
