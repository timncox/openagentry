/**
 * next-auth adapter configuration. Validates the secret + authOptions shape
 * to the extent that next-auth's loose types allow.
 *
 * @module
 */

import type { NextAuthOptions } from 'next-auth';
import { z } from 'zod';

/**
 * Loose zod schema for next-auth providers. We can't structurally validate
 * the full NextAuthOptions union, so we only assert `providers` is a
 * non-empty array of objects.
 */
const authOptionsSchema = z
  .object({
    providers: z.array(z.unknown()).nonempty('authOptions.providers must be a non-empty array'),
  })
  .passthrough();

export const nextAuthConfigSchema = z
  .object({
    secret: z
      .string()
      .trim()
      .min(1, 'secret must be a non-empty NextAuth secret string'),
    authOptions: authOptionsSchema,
  })
  .strict();

export interface NextAuthAdapterConfig {
  secret: string;
  authOptions: NextAuthOptions;
}

export function parseNextAuthConfig(input: unknown): NextAuthAdapterConfig {
  const parsed = nextAuthConfigSchema.parse(input);
  return {
    secret: parsed.secret,
    authOptions: parsed.authOptions as NextAuthOptions,
  };
}
