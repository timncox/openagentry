/**
 * `delete` operation — delete a GitHub repository.
 *
 * Requires a non-empty `ConfirmToken` to guard against accidental deletion.
 * This is a local precondition check, not a GitHub feature.
 *
 * @module
 */

import type { GithubRepoConfig } from './config.js';
import type { Repository, ConfirmToken } from '@openagentry/core';
import { githubFetch } from './http.js';
import { githubError } from './errors.js';

/**
 * Delete a GitHub repository.
 *
 * @param cfg     - Validated adapter config.
 * @param repo    - Repository object (owner + name are the only fields used).
 * @param confirm - A non-empty `ConfirmToken` string. Must be provided and
 *                  non-empty; throws `E_GITHUB_INVALID` otherwise.
 *
 * @throws `AgentryError` (E_GITHUB_INVALID) when `confirm` is missing or empty.
 * @throws `AgentryError` (E_GITHUB_NOT_FOUND) when the repo does not exist.
 * @throws `AgentryError` (E_GITHUB_AUTH, E_GITHUB_PERMISSION, E_GITHUB_RATE_LIMIT,
 *         E_GITHUB_NETWORK, E_GITHUB_UPSTREAM) on other failures.
 */
export async function deleteOp(
  cfg: GithubRepoConfig,
  repo: Repository,
  confirm: ConfirmToken,
): Promise<void> {
  const token = confirm as unknown as string;
  if (typeof token !== 'string' || token.length === 0) {
    throw githubError({
      code: 'E_GITHUB_INVALID',
      phase: 'delete',
      message:
        'deleteOp requires a non-empty ConfirmToken to prevent accidental repo deletion.',
      suggestedFix:
        'Pass a non-empty string as the ConfirmToken (e.g., "confirm-delete").',
    });
  }

  await githubFetch(
    cfg,
    'DELETE',
    '/repos/' + repo.owner + '/' + repo.name,
    undefined,
    'delete',
  );
}
