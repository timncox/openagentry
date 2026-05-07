import { describe, it, expect } from 'vitest';
import { remoteUrl } from '../src/remote-url.js';
import type { GithubRepoConfig } from '../src/config.js';
import type { Repository } from '@openagentry/core';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const DEFAULT_CFG: GithubRepoConfig = {
  token: 'ghp_test_token',
  endpoint: 'https://api.github.com',
};

const GHE_CFG: GithubRepoConfig = {
  token: 'ghp_ghe_token',
  endpoint: 'https://github.example.com/api/v3',
};

const REPO: Repository = {
  owner: 'octocat',
  name: 'hello-world',
  url: 'https://github.com/octocat/hello-world',
  defaultBranch: 'main',
  visibility: 'public',
};

// ---------------------------------------------------------------------------
// Default endpoint (https://api.github.com) → base host github.com
// ---------------------------------------------------------------------------

describe('remoteUrl — default endpoint (api.github.com → github.com)', () => {
  it('returns https clone URL for default endpoint', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'https')).toBe(
      'https://github.com/octocat/hello-world.git',
    );
  });

  it('returns ssh clone URL for default endpoint', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'ssh')).toBe(
      'git@github.com:octocat/hello-world.git',
    );
  });

  it('strips the api. prefix from the hostname', () => {
    const url = remoteUrl(DEFAULT_CFG, REPO, 'https');
    expect(url).not.toContain('api.');
    expect(url).toContain('github.com');
  });
});

// ---------------------------------------------------------------------------
// GHE Server endpoint (https://github.example.com/api/v3 → github.example.com)
// ---------------------------------------------------------------------------

describe('remoteUrl — GHE Server endpoint', () => {
  it('returns https clone URL for GHE endpoint', () => {
    expect(remoteUrl(GHE_CFG, REPO, 'https')).toBe(
      'https://github.example.com/octocat/hello-world.git',
    );
  });

  it('returns ssh clone URL for GHE endpoint', () => {
    expect(remoteUrl(GHE_CFG, REPO, 'ssh')).toBe(
      'git@github.example.com:octocat/hello-world.git',
    );
  });

  it('strips the /api/v3 path component (uses hostname only)', () => {
    const url = remoteUrl(GHE_CFG, REPO, 'https');
    expect(url).not.toContain('/api/v3');
  });

  it('does NOT strip api. from a GHE hostname that lacks it', () => {
    const gheCfgNoApiPrefix: GithubRepoConfig = {
      token: 'ghp_ghe_token',
      endpoint: 'https://github.example.com/api/v3',
    };
    const url = remoteUrl(gheCfgNoApiPrefix, REPO, 'https');
    expect(url).toContain('github.example.com');
    expect(url).not.toContain('api.');
  });
});

// ---------------------------------------------------------------------------
// URL format validation
// ---------------------------------------------------------------------------

describe('remoteUrl — https mode URL format', () => {
  it('starts with https://', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'https')).toMatch(/^https:\/\//);
  });

  it('ends with .git', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'https')).toMatch(/\.git$/);
  });

  it('contains owner/name path', () => {
    const url = remoteUrl(DEFAULT_CFG, REPO, 'https');
    expect(url).toContain('/octocat/hello-world.git');
  });
});

describe('remoteUrl — ssh mode URL format', () => {
  it('starts with git@', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'ssh')).toMatch(/^git@/);
  });

  it('ends with .git', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'ssh')).toMatch(/\.git$/);
  });

  it('uses colon separator between host and path', () => {
    const url = remoteUrl(DEFAULT_CFG, REPO, 'ssh');
    expect(url).toMatch(/^git@[^:]+:octocat\/hello-world\.git$/);
  });

  it('does NOT start with https://', () => {
    expect(remoteUrl(DEFAULT_CFG, REPO, 'ssh')).not.toMatch(/^https:\/\//);
  });
});

// ---------------------------------------------------------------------------
// Owner/name are taken from the repo object, not the config
// ---------------------------------------------------------------------------

describe('remoteUrl — uses repo owner and name', () => {
  it('uses the org name when owner is an org', () => {
    const orgRepo: Repository = {
      ...REPO,
      owner: 'acme-org',
      name: 'backend-api',
    };
    expect(remoteUrl(DEFAULT_CFG, orgRepo, 'https')).toBe(
      'https://github.com/acme-org/backend-api.git',
    );
    expect(remoteUrl(DEFAULT_CFG, orgRepo, 'ssh')).toBe(
      'git@github.com:acme-org/backend-api.git',
    );
  });

  it('handles repo names with hyphens and underscores', () => {
    const specialRepo: Repository = {
      ...REPO,
      owner: 'my-org',
      name: 'my_repo-2024',
    };
    expect(remoteUrl(DEFAULT_CFG, specialRepo, 'https')).toBe(
      'https://github.com/my-org/my_repo-2024.git',
    );
  });
});

// ---------------------------------------------------------------------------
// remoteUrl is synchronous — no promise returned
// ---------------------------------------------------------------------------

describe('remoteUrl — synchronous', () => {
  it('returns a string directly (not a Promise)', () => {
    const result = remoteUrl(DEFAULT_CFG, REPO, 'https');
    expect(typeof result).toBe('string');
    expect(result).not.toBeInstanceOf(Promise);
  });
});
