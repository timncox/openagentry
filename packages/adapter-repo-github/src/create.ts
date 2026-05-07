/**
 * `create` operation — create a new GitHub repository.
 *
 * The authenticated user login is probed once per adapter config instance
 * via `GET /user` and cached in a module-level WeakMap. Subsequent calls
 * skip the probe entirely.
 *
 * @module
 */

import type { Repository, RepoCreateOpts } from '@openagentry/core';
import type { GithubRepoConfig } from './config.js';
import { githubFetch } from './http.js';

// ---------------------------------------------------------------------------
// Login cache — per config instance, not per call.
// ---------------------------------------------------------------------------

/** Cached authenticated user login per adapter config instance. */
const loginCache = new WeakMap<GithubRepoConfig, string>();

/**
 * Return the GitHub login of the authenticated user (token owner).
 *
 * Hits `GET /user` on first call per config instance; subsequent calls return
 * the cached value without a network round-trip.
 *
 * @throws `AgentryError` (E_GITHUB_AUTH, E_GITHUB_NETWORK, etc.) on failure.
 */
export async function getAuthenticatedLogin(cfg: GithubRepoConfig): Promise<string> {
  const cached = loginCache.get(cfg);
  if (cached !== undefined) return cached;

  const res = await githubFetch(cfg, 'GET', '/user', undefined, 'createProject');
  const login = (res.json as { login: string }).login;
  loginCache.set(cfg, login);
  return login;
}

// ---------------------------------------------------------------------------
// Repo-response mapper (same logic as get.ts, intentionally co-located).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// create op
// ---------------------------------------------------------------------------

/**
 * Create a new GitHub repository.
 *
 * Probes `GET /user` once to learn the authenticated login, then routes to
 * `POST /user/repos` (personal) or `POST /orgs/{owner}/repos` (org) depending
 * on whether `opts.owner` matches the authenticated login.
 *
 * Undefined optional fields are stripped from the request body before sending
 * so GitHub does not receive explicit `undefined` (which serialises as absent
 * in JSON anyway, but this is explicit).
 *
 * @param cfg  - Validated adapter config.
 * @param opts - Repository creation options.
 *
 * @returns The newly created `Repository`.
 *
 * @throws `AgentryError` (E_GITHUB_INVALID for name conflicts, E_GITHUB_AUTH,
 *         E_GITHUB_PERMISSION, E_GITHUB_RATE_LIMIT, E_GITHUB_NETWORK,
 *         E_GITHUB_UPSTREAM) on failure.
 */
export async function createOp(cfg: GithubRepoConfig, opts: RepoCreateOpts): Promise<Repository> {
  // Probe — cached after the first call.
  const login = await getAuthenticatedLogin(cfg);

  // Route: personal vs org.
  const path = opts.owner === login ? '/user/repos' : `/orgs/${opts.owner}/repos`;

  // Build the request body, stripping undefined values.
  const bodyRaw: Record<string, unknown> = {
    name: opts.name,
    private: opts.visibility === 'private',
    description: opts.description,
    default_branch: opts.defaultBranch,
    auto_init: opts.initWithReadme ?? false,
  };

  // Remove keys whose value is undefined so they are absent from the JSON.
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bodyRaw)) {
    if (v !== undefined) body[k] = v;
  }

  const res = await githubFetch(cfg, 'POST', path, body, 'createProject');
  return mapRepo(res.json);
}
