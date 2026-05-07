/**
 * `get` operation — fetch a single GitHub repository.
 *
 * Returns `null` when the repository does not exist (404 → E_GITHUB_NOT_FOUND
 * is caught and converted to `null`). All other errors propagate as-is.
 *
 * @module
 */

import type { Repository } from '@openagentry/core';
import type { GithubRepoConfig } from './config.js';
import { githubFetch } from './http.js';
import { GITHUB_ERROR_CODES } from './errors.js';

/**
 * Map a raw GitHub API repository response to the canonical `Repository` shape.
 *
 * GitHub Enterprise Server repos with `visibility: 'internal'` have
 * `private: true` in the API response — those map to `'private'` per spec.
 */
function mapRepo(json: unknown): Repository {
  const j = json as {
    owner: { login: string };
    name: string;
    html_url: string;
    default_branch: string;
    private: boolean;
  };
  return {
    owner: j.owner.login,
    name: j.name,
    url: j.html_url,
    defaultBranch: j.default_branch,
    visibility: j.private ? 'private' : 'public',
  };
}

/**
 * Fetch a GitHub repository by owner + name.
 *
 * @param cfg   - Validated adapter config.
 * @param owner - GitHub user or org login that owns the repo.
 * @param name  - Repository name.
 *
 * @returns The `Repository` when found, or `null` when the repo does not exist.
 *
 * @throws `AgentryError` (E_GITHUB_AUTH, E_GITHUB_PERMISSION, E_GITHUB_NETWORK,
 *         E_GITHUB_UPSTREAM, etc.) for any error other than 404-not-found.
 */
export async function getOp(
  cfg: GithubRepoConfig,
  owner: string,
  name: string,
): Promise<Repository | null> {
  try {
    const res = await githubFetch(cfg, 'GET', `/repos/${owner}/${name}`, undefined, 'read');
    return mapRepo(res.json);
  } catch (err) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === GITHUB_ERROR_CODES.NOT_FOUND
    ) {
      return null;
    }
    throw err;
  }
}
