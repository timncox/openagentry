import { describe, it, expect } from 'vitest';
import { parseGithubRepoConfig, githubRepoConfigSchema } from '../src/config.js';

// ---------------------------------------------------------------------------
// Valid inputs
// ---------------------------------------------------------------------------

describe('parseGithubRepoConfig — valid inputs', () => {
  it('accepts a minimal config with just token', () => {
    const cfg = parseGithubRepoConfig({ token: 'ghp_abc123' });
    expect(cfg.token).toBe('ghp_abc123');
  });

  it('defaults endpoint to https://api.github.com when not provided', () => {
    const cfg = parseGithubRepoConfig({ token: 'ghp_abc123' });
    expect(cfg.endpoint).toBe('https://api.github.com');
  });

  it('respects an explicit endpoint when provided', () => {
    const cfg = parseGithubRepoConfig({
      token: 'ghp_abc123',
      endpoint: 'https://github.example.com/api/v3',
    });
    expect(cfg.endpoint).toBe('https://github.example.com/api/v3');
  });

  it('trims leading/trailing whitespace from token', () => {
    const cfg = parseGithubRepoConfig({ token: '  ghp_trimmed  ' });
    expect(cfg.token).toBe('ghp_trimmed');
  });

  it('accepts a fine-grained PAT (github_pat_ prefix)', () => {
    const cfg = parseGithubRepoConfig({
      token: 'github_pat_AAAAAAAAAAAAA_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    });
    expect(cfg.token).toMatch(/^github_pat_/);
  });

  it('endpoint is always a string (never undefined) after parse', () => {
    const cfg = parseGithubRepoConfig({ token: 'ghp_x' });
    expect(typeof cfg.endpoint).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — schema errors
// ---------------------------------------------------------------------------

describe('parseGithubRepoConfig — missing token', () => {
  it('throws E_GITHUB_SCHEMA when token is missing', () => {
    expect(() => parseGithubRepoConfig({ endpoint: 'https://api.github.com' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_GITHUB_SCHEMA when input is empty object', () => {
    expect(() => parseGithubRepoConfig({})).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });

  it('throws E_GITHUB_SCHEMA when input is null', () => {
    expect(() => parseGithubRepoConfig(null)).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });

  it('throws E_GITHUB_SCHEMA when input is undefined', () => {
    expect(() => parseGithubRepoConfig(undefined)).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });
});

describe('parseGithubRepoConfig — empty/whitespace-only token', () => {
  it('throws E_GITHUB_SCHEMA for empty string token', () => {
    expect(() => parseGithubRepoConfig({ token: '' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_GITHUB_SCHEMA for whitespace-only token (trim().min(1) rejects it)', () => {
    expect(() => parseGithubRepoConfig({ token: '   ' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_GITHUB_SCHEMA for tab-only token', () => {
    expect(() => parseGithubRepoConfig({ token: '\t\n' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });
});

describe('parseGithubRepoConfig — invalid endpoint', () => {
  it('throws E_GITHUB_SCHEMA for non-URL endpoint', () => {
    expect(() => parseGithubRepoConfig({ token: 'ghp_x', endpoint: 'not-a-url' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });

  it('throws E_GITHUB_SCHEMA for endpoint without protocol', () => {
    expect(() => parseGithubRepoConfig({ token: 'ghp_x', endpoint: 'api.github.com' })).toThrow(
      expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }),
    );
  });
});

describe('parseGithubRepoConfig — strict mode rejects unknown keys', () => {
  it('throws E_GITHUB_SCHEMA when an unknown key is present', () => {
    expect(() =>
      parseGithubRepoConfig({ token: 'ghp_x', unknownField: 'oops' }),
    ).toThrow(expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }));
  });

  it('throws E_GITHUB_SCHEMA for multiple unknown keys', () => {
    expect(() =>
      parseGithubRepoConfig({ token: 'ghp_x', a: 1, b: 2 }),
    ).toThrow(expect.objectContaining({ code: 'E_GITHUB_SCHEMA' }));
  });
});

describe('parseGithubRepoConfig — zodIssues in context', () => {
  it('includes zodIssues in error context', () => {
    try {
      parseGithubRepoConfig({});
    } catch (err) {
      const issues = (err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues;
      expect(Array.isArray(issues)).toBe(true);
      expect((issues as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('zodIssues is an array even when only one issue exists', () => {
    try {
      parseGithubRepoConfig({ token: '' });
    } catch (err) {
      const issues = (err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues;
      expect(Array.isArray(issues)).toBe(true);
    }
  });
});

describe('githubRepoConfigSchema — exported for advanced consumers', () => {
  it('schema is exported and usable with safeParse', () => {
    const result = githubRepoConfigSchema.safeParse({ token: 'ghp_x' });
    expect(result.success).toBe(true);
  });

  it('schema rejects via safeParse for empty token', () => {
    const result = githubRepoConfigSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });
});
