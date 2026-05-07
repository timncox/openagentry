/**
 * GitHub RepoAdapter factory. Returns a frozen object implementing the core
 * RepoAdapter interface. Each method delegates to the corresponding op function.
 *
 * @module
 */

import type { RepoAdapter, Repository, RepoCreateOpts, ConfirmToken } from '@openagentry/core';
import {
  parseGithubRepoConfig,
  type GithubRepoConfigInput,
  type GithubRepoConfig,
} from './config.js';
import { createOp } from './create.js';
import { deleteOp } from './delete.js';
import { getOp } from './get.js';
import { remoteUrl as remoteUrlFn } from './remote-url.js';
import { ADAPTER_ID } from './errors.js';

export function createGithubRepoAdapter(
  input: GithubRepoConfigInput,
): RepoAdapter {
  const cfg: GithubRepoConfig = parseGithubRepoConfig(input);
  return Object.freeze({
    category: 'repo' as const,
    id: ADAPTER_ID,

    create(opts: RepoCreateOpts): Promise<Repository> {
      return createOp(cfg, opts);
    },

    delete(repo: Repository, confirm: ConfirmToken): Promise<void> {
      return deleteOp(cfg, repo, confirm);
    },

    get(owner: string, name: string): Promise<Repository | null> {
      return getOp(cfg, owner, name);
    },

    /**
     * remoteUrl is synchronous — returns a plain string, never a Promise.
     * This matches the RepoAdapter interface declaration: `remoteUrl(repo, mode): string`.
     */
    remoteUrl(repo: Repository, mode: 'https' | 'ssh'): string {
      return remoteUrlFn(cfg, repo, mode);
    },
  });
}
