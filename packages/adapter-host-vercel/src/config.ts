/**
 * Zod-validated configuration for the Vercel host adapter.
 *
 * @module
 */

import { z } from 'zod';
import { vercelError } from './errors.js';

export const vercelHostConfigSchema = z
  .object({
    token: z.string().trim().min(1, 'token must be a non-empty string'),
    teamId: z.string().trim().min(1).optional(),
    endpoint: z.string().url().optional(),
  })
  .strict();

export type VercelHostConfigInput = z.input<typeof vercelHostConfigSchema>;
export type VercelHostConfigParsed = z.output<typeof vercelHostConfigSchema>;

/**
 * Fully-resolved config: all optional fields are filled in.
 * `endpoint` is always a string (defaults to 'https://api.vercel.com').
 * `teamId` remains optional — only set when scoping to a team.
 */
export interface VercelHostConfig extends VercelHostConfigParsed {
  endpoint: string;
}

const DEFAULT_ENDPOINT = 'https://api.vercel.com';

/**
 * Parse and validate raw input into a fully-resolved `VercelHostConfig`.
 *
 * Throws `E_VERCEL_SCHEMA` (phase: 'init') on any schema violation.
 * After parse, `endpoint` is always a string (default applied if absent).
 */
export function parseVercelHostConfig(input: unknown): VercelHostConfig {
  let parsed: VercelHostConfigParsed;
  try {
    parsed = vercelHostConfigSchema.parse(input);
  } catch (err) {
    const zodIssues = (err as { issues?: unknown[] }).issues ?? [];
    throw vercelError({
      code: 'E_VERCEL_SCHEMA',
      message: 'Invalid Vercel host adapter configuration',
      phase: 'init',
      suggestedFix:
        'Check all required config fields: token must be a non-empty string. ' +
        'teamId and endpoint are optional. endpoint must be a valid URL. ' +
        'See context.zodIssues for details.',
      context: { zodIssues },
    });
  }

  return {
    token: parsed.token,
    ...(parsed.teamId !== undefined ? { teamId: parsed.teamId } : {}),
    endpoint: parsed.endpoint ?? DEFAULT_ENDPOINT,
  };
}
