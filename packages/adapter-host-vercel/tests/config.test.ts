import { describe, it, expect } from 'vitest';
import { parseVercelHostConfig, vercelHostConfigSchema } from '../src/config.js';

// ---------------------------------------------------------------------------
// Valid inputs
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — valid inputs', () => {
  it('accepts a minimal config with just token', () => {
    const cfg = parseVercelHostConfig({ token: 'vercel_token_abc123' });
    expect(cfg.token).toBe('vercel_token_abc123');
  });

  it('defaults endpoint to https://api.vercel.com when not provided', () => {
    const cfg = parseVercelHostConfig({ token: 'vercel_token_abc123' });
    expect(cfg.endpoint).toBe('https://api.vercel.com');
  });

  it('respects an explicit endpoint when provided', () => {
    const cfg = parseVercelHostConfig({
      token: 'vercel_token_abc123',
      endpoint: 'https://api.vercel.example.com',
    });
    expect(cfg.endpoint).toBe('https://api.vercel.example.com');
  });

  it('trims leading/trailing whitespace from token', () => {
    const cfg = parseVercelHostConfig({ token: '  vercel_trimmed  ' });
    expect(cfg.token).toBe('vercel_trimmed');
  });

  it('trims leading/trailing whitespace from teamId', () => {
    const cfg = parseVercelHostConfig({ token: 'tok', teamId: '  team_abc  ' });
    expect(cfg.teamId).toBe('team_abc');
  });

  it('endpoint is always a string (never undefined) after parse', () => {
    const cfg = parseVercelHostConfig({ token: 'tok' });
    expect(typeof cfg.endpoint).toBe('string');
  });

  it('teamId is omitted when not provided', () => {
    const cfg = parseVercelHostConfig({ token: 'tok' });
    expect('teamId' in cfg).toBe(false);
  });

  it('teamId is present when provided', () => {
    const cfg = parseVercelHostConfig({ token: 'tok', teamId: 'team_xyz' });
    expect(cfg.teamId).toBe('team_xyz');
  });

  it('accepts token + teamId + explicit endpoint together', () => {
    const cfg = parseVercelHostConfig({
      token: 'vercel_token_full',
      teamId: 'team_myorg',
      endpoint: 'https://api.vercel.com',
    });
    expect(cfg.token).toBe('vercel_token_full');
    expect(cfg.teamId).toBe('team_myorg');
    expect(cfg.endpoint).toBe('https://api.vercel.com');
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — missing token
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — missing token', () => {
  it('throws E_VERCEL_SCHEMA when token is missing', () => {
    expect(() => parseVercelHostConfig({ endpoint: 'https://api.vercel.com' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_VERCEL_SCHEMA when input is empty object', () => {
    expect(() => parseVercelHostConfig({})).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });

  it('throws E_VERCEL_SCHEMA when input is null', () => {
    expect(() => parseVercelHostConfig(null)).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });

  it('throws E_VERCEL_SCHEMA when input is undefined', () => {
    expect(() => parseVercelHostConfig(undefined)).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — empty/whitespace-only token
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — empty/whitespace-only token', () => {
  it('throws E_VERCEL_SCHEMA for empty string token', () => {
    expect(() => parseVercelHostConfig({ token: '' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_VERCEL_SCHEMA for whitespace-only token (trim().min(1) rejects it)', () => {
    expect(() => parseVercelHostConfig({ token: '   ' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA', phase: 'init' }),
    );
  });

  it('throws E_VERCEL_SCHEMA for tab-only token', () => {
    expect(() => parseVercelHostConfig({ token: '\t\n' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — empty teamId (whitespace-only)
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — empty/whitespace teamId', () => {
  it('throws E_VERCEL_SCHEMA for empty string teamId', () => {
    expect(() => parseVercelHostConfig({ token: 'tok', teamId: '' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });

  it('throws E_VERCEL_SCHEMA for whitespace-only teamId', () => {
    expect(() => parseVercelHostConfig({ token: 'tok', teamId: '   ' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs — bad endpoint
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — invalid endpoint', () => {
  it('throws E_VERCEL_SCHEMA for non-URL endpoint', () => {
    expect(() => parseVercelHostConfig({ token: 'tok', endpoint: 'not-a-url' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });

  it('throws E_VERCEL_SCHEMA for endpoint without protocol', () => {
    expect(() => parseVercelHostConfig({ token: 'tok', endpoint: 'api.vercel.com' })).toThrow(
      expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Strict mode — unknown keys rejected
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — strict mode rejects unknown keys', () => {
  it('throws E_VERCEL_SCHEMA when an unknown key is present', () => {
    expect(() =>
      parseVercelHostConfig({ token: 'tok', unknownField: 'oops' }),
    ).toThrow(expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }));
  });

  it('throws E_VERCEL_SCHEMA for multiple unknown keys', () => {
    expect(() =>
      parseVercelHostConfig({ token: 'tok', a: 1, b: 2 }),
    ).toThrow(expect.objectContaining({ code: 'E_VERCEL_SCHEMA' }));
  });
});

// ---------------------------------------------------------------------------
// zodIssues in context
// ---------------------------------------------------------------------------

describe('parseVercelHostConfig — zodIssues in context', () => {
  it('includes zodIssues in error context', () => {
    try {
      parseVercelHostConfig({});
    } catch (err) {
      const issues = (err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues;
      expect(Array.isArray(issues)).toBe(true);
      expect((issues as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('zodIssues is an array even when only one issue exists', () => {
    try {
      parseVercelHostConfig({ token: '' });
    } catch (err) {
      const issues = (err as { context?: { zodIssues?: unknown[] } }).context?.zodIssues;
      expect(Array.isArray(issues)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema exported for advanced consumers
// ---------------------------------------------------------------------------

describe('vercelHostConfigSchema — exported for advanced consumers', () => {
  it('schema is exported and usable with safeParse', () => {
    const result = vercelHostConfigSchema.safeParse({ token: 'tok' });
    expect(result.success).toBe(true);
  });

  it('schema rejects via safeParse for empty token', () => {
    const result = vercelHostConfigSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('schema rejects via safeParse for unknown key', () => {
    const result = vercelHostConfigSchema.safeParse({ token: 'tok', extra: true });
    expect(result.success).toBe(false);
  });
});
