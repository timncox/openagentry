/**
 * Zod-validated configuration for the GitHub repo adapter.
 *
 * @module
 */

import { z } from 'zod';
import { githubError } from './errors.js';

export const githubRepoConfigSchema = z
  .object({
    token: z.string().trim().min(1, 'token must be a non-empty string'),
    endpoint: z.string().url().optional(),
  })
  .strict();

export type GithubRepoConfigInput = z.input<typeof githubRepoConfigSchema>;
export type GithubRepoConfigParsed = z.output<typeof githubRepoConfigSchema>;

/**
 * Fully-resolved config: all optional fields are filled in.
 * `endpoint` is always a string (defaults to 'https://api.github.com').
 */
export interface GithubRepoConfig extends GithubRepoConfigParsed {
  endpoint: string;
}

const DEFAULT_ENDPOINT = 'https://api.github.com';

export function parseGithubRepoConfig(input: unknown): GithubRepoConfig {
  let parsed: GithubRepoConfigParsed;
  try {
    parsed = githubRepoConfigSchema.parse(input);
  } catch (err) {
    const zodIssues = (err as { issues?: unknown[] }).issues ?? [];
    throw githubError({
      code: 'E_GITHUB_SCHEMA',
      message: 'Invalid GitHub repo adapter configuration',
      phase: 'init',
      suggestedFix:
        'Check all required config fields: token must be a non-empty string. See context.zodIssues for details.',
      context: { zodIssues },
    });
  }

  return {
    token: parsed.token,
    endpoint: parsed.endpoint ?? DEFAULT_ENDPOINT,
  };
}
