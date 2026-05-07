/**
 * `remoteUrl` — derive the git remote URL for a repository.
 *
 * Synchronous string-formatting only. No network I/O.
 *
 * Derives the base host from `cfg.endpoint`:
 *   - `https://api.github.com`               → `github.com`  (api. prefix stripped)
 *   - `https://github.example.com/api/v3`    → `github.example.com`  (path stripped)
 *
 * @module
 */

import type { GithubRepoConfig } from './config.js';
import type { Repository } from '@openagentry/core';

/**
 * Derive the git remote URL for a GitHub repository.
 *
 * @param cfg  - Validated adapter config (endpoint used to derive base host).
 * @param repo - Repository object (owner + name are the only fields used).
 * @param mode - `'https'` for HTTPS clone URL; `'ssh'` for SSH clone URL.
 *
 * @returns The git remote URL string.
 *
 * @example
 * remoteUrl(cfg, { owner: 'octocat', name: 'hello-world', ... }, 'https')
 * // → 'https://github.com/octocat/hello-world.git'
 *
 * @example
 * remoteUrl(cfg, { owner: 'octocat', name: 'hello-world', ... }, 'ssh')
 * // → 'git@github.com:octocat/hello-world.git'
 */
export function remoteUrl(
  cfg: GithubRepoConfig,
  repo: Repository,
  mode: 'https' | 'ssh',
): string {
  const baseHost = deriveBaseHost(cfg.endpoint);

  if (mode === 'https') {
    return `https://${baseHost}/${repo.owner}/${repo.name}.git`;
  }

  // ssh
  return `git@${baseHost}:${repo.owner}/${repo.name}.git`;
}

/**
 * Derive the base git host from a GitHub API endpoint URL.
 *
 * Rules:
 * 1. Parse the URL to get its hostname.
 * 2. If hostname starts with `api.`, strip that prefix.
 *    (Handles the default `https://api.github.com` → `github.com`.)
 * 3. Otherwise return the hostname as-is.
 *    (Handles GHE Server `https://github.example.com/api/v3` → `github.example.com`.)
 *
 * The URL path (e.g. `/api/v3`) is intentionally ignored — only the hostname
 * matters for constructing git remote URLs.
 */
function deriveBaseHost(endpoint: string): string {
  const url = new URL(endpoint);
  const hostname = url.hostname;

  if (hostname.startsWith('api.')) {
    return hostname.slice('api.'.length);
  }

  return hostname;
}
