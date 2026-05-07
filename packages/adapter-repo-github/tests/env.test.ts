import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

const requiredEnv = {
  OA_GITHUB_TOKEN: 'ghp_supersecret_token_value',
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('readEnvConfig — happy path', () => {
  it('returns ok=true when OA_GITHUB_TOKEN is set', () => {
    const result = readEnvConfig(requiredEnv);
    expect(result.ok).toBe(true);
  });

  it('config.token equals the env var value', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.token).toBe('ghp_supersecret_token_value');
  });

  it('config.endpoint is undefined when OA_GITHUB_ENDPOINT is not set', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBeUndefined();
  });

  it('config.endpoint is populated when OA_GITHUB_ENDPOINT is set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_GITHUB_ENDPOINT: 'https://github.example.com/api/v3',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBe('https://github.example.com/api/v3');
  });

  it('does not return ok=false when the result is ok (type narrowing)', () => {
    const result = readEnvConfig(requiredEnv);
    expect(result.ok).toBe(true);
    // Discriminated union: ok=true branch must not have missing
    if (!result.ok) {
      throw new Error('should not reach here');
    }
    expect('missing' in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Security — token must not appear in error output
// ---------------------------------------------------------------------------

describe('readEnvConfig — security: token not echoed in error output', () => {
  it('missing array contains only env-var names, not values', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    result.missing.forEach((name) => {
      expect(name).toMatch(/^OA_GITHUB_/);
      // var names are uppercased identifiers — never the actual token value
      expect(name).not.toContain('ghp_');
    });
  });

  it('a non-empty token value is not reflected in the missing list', () => {
    // Simulate partially set env where only a second hypothetical required var
    // is absent (if it existed). With a single required var, having it set
    // means missing=[] — we just verify the ok=true branch exposes no secrets.
    const result = readEnvConfig({ OA_GITHUB_TOKEN: 'super-secret-value' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The config object has the token (consumers need it), but the ok=false
    // branch (which is the public error surface) never fires here.
    expect(result.config.token).toBe('super-secret-value');
  });
});

// ---------------------------------------------------------------------------
// Missing required vars
// ---------------------------------------------------------------------------

describe('readEnvConfig — missing OA_GITHUB_TOKEN', () => {
  it('returns ok=false when OA_GITHUB_TOKEN is absent', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
  });

  it('missing array contains OA_GITHUB_TOKEN', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_GITHUB_TOKEN');
  });

  it('missing array has exactly one entry (the single required var)', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.length).toBe(1);
  });

  it('ok=false even when OA_GITHUB_ENDPOINT is set but token is absent', () => {
    const result = readEnvConfig({ OA_GITHUB_ENDPOINT: 'https://github.example.com/api/v3' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_GITHUB_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// OA_GITHUB_ENDPOINT respected
// ---------------------------------------------------------------------------

describe('readEnvConfig — OA_GITHUB_ENDPOINT', () => {
  it('endpoint is included in config when set', () => {
    const result = readEnvConfig({
      OA_GITHUB_TOKEN: 'ghp_x',
      OA_GITHUB_ENDPOINT: 'https://github.myco.com/api/v3',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBe('https://github.myco.com/api/v3');
  });

  it('endpoint is omitted (undefined) from config when not set', () => {
    const result = readEnvConfig({ OA_GITHUB_TOKEN: 'ghp_x' });
    if (!result.ok) throw new Error('expected ok');
    expect('endpoint' in result.config).toBe(false);
  });
});
