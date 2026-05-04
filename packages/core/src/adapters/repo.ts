/**
 * RepoAdapter — git repository hosting (GitHub, GitLab, Bitbucket).
 *
 * @module
 */

export interface Repository {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  visibility: 'public' | 'private';
}

export interface RepoCreateOpts {
  owner: string;
  name: string;
  visibility: 'public' | 'private';
  description?: string;
  defaultBranch?: string;
  /** If true, initialize with a README. */
  initWithReadme?: boolean;
}

export interface RepoAdapter {
  readonly category: 'repo';
  readonly id: string;

  create(opts: RepoCreateOpts): Promise<Repository>;
  delete(repo: Repository): Promise<void>;
  get(owner: string, name: string): Promise<Repository | null>;
  /** Returns the URL the local git remote should point at. */
  remoteUrl(repo: Repository, mode: 'https' | 'ssh'): string;
}
