import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

const requiredEnv = {
  OA_VERCEL_TOKEN: 'vercel_supersecret_token_value',
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('readEnvConfig — happy path', () => {
  it('returns ok=true when OA_VERCEL_TOKEN is set', () => {
    const result = readEnvConfig(requiredEnv);
    expect(result.ok).toBe(true);
  });

  it('config.token equals the env var value', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.token).toBe('vercel_supersecret_token_value');
  });

  it('config.teamId is undefined when OA_VERCEL_TEAM_ID is not set', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.teamId).toBeUndefined();
  });

  it('config.endpoint is undefined when OA_VERCEL_ENDPOINT is not set', () => {
    const result = readEnvConfig(requiredEnv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBeUndefined();
  });

  it('config.teamId is populated when OA_VERCEL_TEAM_ID is set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_VERCEL_TEAM_ID: 'team_myorg',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.teamId).toBe('team_myorg');
  });

  it('config.endpoint is populated when OA_VERCEL_ENDPOINT is set', () => {
    const result = readEnvConfig({
      ...requiredEnv,
      OA_VERCEL_ENDPOINT: 'https://api.vercel.example.com',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBe('https://api.vercel.example.com');
  });

  it('all three fields populated when all three env vars are set', () => {
    const result = readEnvConfig({
      OA_VERCEL_TOKEN: 'tok_full',
      OA_VERCEL_TEAM_ID: 'team_full',
      OA_VERCEL_ENDPOINT: 'https://api.vercel.example.com',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.token).toBe('tok_full');
    expect(result.config.teamId).toBe('team_full');
    expect(result.config.endpoint).toBe('https://api.vercel.example.com');
  });

  it('does not return ok=false when the result is ok (type narrowing)', () => {
    const result = readEnvConfig(requiredEnv);
    expect(result.ok).toBe(true);
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
      expect(name).toMatch(/^OA_VERCEL_/);
      // var names are uppercased identifiers — never the actual token value
      expect(name).not.toContain('vercel_');
    });
  });

  it('a non-empty token value is not reflected in the missing list', () => {
    const result = readEnvConfig({ OA_VERCEL_TOKEN: 'super-secret-vercel-value' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.token).toBe('super-secret-vercel-value');
  });
});

// ---------------------------------------------------------------------------
// Missing required vars
// ---------------------------------------------------------------------------

describe('readEnvConfig — missing OA_VERCEL_TOKEN', () => {
  it('returns ok=false when OA_VERCEL_TOKEN is absent', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
  });

  it('missing array contains OA_VERCEL_TOKEN', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_VERCEL_TOKEN');
  });

  it('missing array has exactly one entry (the single required var)', () => {
    const result = readEnvConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.length).toBe(1);
  });

  it('ok=false even when OA_VERCEL_TEAM_ID is set but token is absent', () => {
    const result = readEnvConfig({ OA_VERCEL_TEAM_ID: 'team_abc' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_VERCEL_TOKEN');
  });

  it('ok=false even when OA_VERCEL_ENDPOINT is set but token is absent', () => {
    const result = readEnvConfig({ OA_VERCEL_ENDPOINT: 'https://api.vercel.example.com' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_VERCEL_TOKEN');
  });

  it('ok=false when both optional vars are set but token is absent', () => {
    const result = readEnvConfig({
      OA_VERCEL_TEAM_ID: 'team_abc',
      OA_VERCEL_ENDPOINT: 'https://api.vercel.example.com',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('OA_VERCEL_TOKEN');
    expect(result.missing.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Optional vars respected
// ---------------------------------------------------------------------------

describe('readEnvConfig — OA_VERCEL_TEAM_ID', () => {
  it('teamId is included in config when set', () => {
    const result = readEnvConfig({
      OA_VERCEL_TOKEN: 'tok',
      OA_VERCEL_TEAM_ID: 'team_myco',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.teamId).toBe('team_myco');
  });

  it('teamId is absent from config when not set', () => {
    const result = readEnvConfig({ OA_VERCEL_TOKEN: 'tok' });
    if (!result.ok) throw new Error('expected ok');
    expect('teamId' in result.config).toBe(false);
  });
});

describe('readEnvConfig — OA_VERCEL_ENDPOINT', () => {
  it('endpoint is included in config when set', () => {
    const result = readEnvConfig({
      OA_VERCEL_TOKEN: 'tok',
      OA_VERCEL_ENDPOINT: 'https://api.vercel.myco.com',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.config.endpoint).toBe('https://api.vercel.myco.com');
  });

  it('endpoint is absent from config when not set', () => {
    const result = readEnvConfig({ OA_VERCEL_TOKEN: 'tok' });
    if (!result.ok) throw new Error('expected ok');
    expect('endpoint' in result.config).toBe(false);
  });
});
