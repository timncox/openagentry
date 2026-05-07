/**
 * @openagentry/adapter-repo-github — public exports + lazy default export
 * resolved from OA_GITHUB_* env vars.
 *
 * @module
 */

import type { RepoAdapter, Repository, RepoCreateOpts, ConfirmToken } from '@openagentry/core';
import { createGithubRepoAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { githubError, GITHUB_ERROR_CODES, ADAPTER_ID } from './errors.js';

// ─── Public exports ───────────────────────────────────────────────────────────

export { createGithubRepoAdapter } from './adapter.js';
export {
  parseGithubRepoConfig,
  githubRepoConfigSchema,
  type GithubRepoConfig,
  type GithubRepoConfigInput,
  type GithubRepoConfigParsed,
} from './config.js';
export {
  ADAPTER_ID,
  GITHUB_ERROR_CODES,
  type GithubErrorCode,
} from './errors.js';

// ─── Lazy default ─────────────────────────────────────────────────────────────

let cached: RepoAdapter | undefined;

/**
 * Construct a GithubRepoAdapter from OA_GITHUB_* env vars and cache it.
 * Throws a synchronous AgentryError when required env vars are missing or invalid.
 * This is intentional — the lazy wrapper below catches the sync throw and converts
 * it to Promise.reject so the async contract of create/delete/get is preserved
 * (Plan K bug #2). The sync method remoteUrl lets the throw escape directly.
 */
function buildFromEnv(): RepoAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (!result.ok) {
    throw githubError({
      code: GITHUB_ERROR_CODES.AUTH,
      message: `Missing required env vars: ${result.missing.join(', ')}`,
      phase: 'init',
      context: { missing: result.missing },
      suggestedFix:
        `Set ${result.missing.join(', ')} in your environment before using the default adapter, ` +
        `or call createGithubRepoAdapter(config) directly. ` +
        `OA_GITHUB_TOKEN must have repo scope (classic PAT) or Administration+Metadata read permissions (fine-grained PAT).`,
    });
  }
  cached = createGithubRepoAdapter(result.config);
  return cached;
}

/**
 * Lazy default RepoAdapter. Each async method (create, delete, get) builds or
 * reuses the underlying adapter from env vars on first call. Sync throws from
 * buildFromEnv() are caught and converted to Promise.reject so the async contract
 * is always honoured (Plan K bug #2).
 *
 * remoteUrl is declared synchronous in RepoAdapter — its wrapper calls
 * buildFromEnv() directly and lets any sync throw escape to the caller, which is
 * the correct behaviour for a sync method. Documented here for clarity.
 *
 * `category` and `id` are static — they never trigger env init.
 */
const lazyAdapter: RepoAdapter = Object.freeze({
  category: 'repo' as const,
  id: ADAPTER_ID,

  /**
   * Async — Plan K bug #2 pattern: catch sync throw from buildFromEnv()
   * and convert to Promise.reject so callers always get a Promise back.
   */
  create(opts: RepoCreateOpts): Promise<Repository> {
    let adapter: RepoAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.create(opts);
  },

  /**
   * Async — Plan K bug #2 pattern applied.
   */
  delete(repo: Repository, confirm: ConfirmToken): Promise<void> {
    let adapter: RepoAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.delete(repo, confirm);
  },

  /**
   * Async — Plan K bug #2 pattern applied.
   */
  get(owner: string, name: string): Promise<Repository | null> {
    let adapter: RepoAdapter;
    try {
      adapter = buildFromEnv();
    } catch (err) {
      return Promise.reject(err);
    }
    return adapter.get(owner, name);
  },

  /**
   * Synchronous — does NOT use try/catch → Promise.reject.
   * remoteUrl is declared as `: string` (not Promise<string>) in the RepoAdapter
   * interface. Callers of a sync method are expected to handle sync throws.
   * buildFromEnv() is still called here on first invocation so the caller can
   * observe a structured AgentryError synchronously when env is missing.
   */
  remoteUrl(repo: Repository, mode: 'https' | 'ssh'): string {
    // remoteUrl is sync — sync throws from buildFromEnv() escape directly.
    return buildFromEnv().remoteUrl(repo, mode);
  },
});

export default lazyAdapter;
