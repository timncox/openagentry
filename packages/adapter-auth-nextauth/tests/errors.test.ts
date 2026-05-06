import { describe, it, expect } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  NEXT_AUTH_ERROR_CODES,
  nextAuthError,
  nextAuthErrorFromCause,
} from '../src/errors.js';

describe('NEXT_AUTH_ERROR_CODES', () => {
  it('exposes 5 codes', () => {
    expect(Object.keys(NEXT_AUTH_ERROR_CODES).sort()).toEqual([
      'API',
      'AUTH',
      'NETWORK',
      'NOT_FOUND',
      'SCHEMA',
    ]);
  });
});

describe('ADAPTER_ID', () => {
  it('is "auth-nextauth"', () => {
    expect(ADAPTER_ID).toBe('auth-nextauth');
  });
});

describe('nextAuthError', () => {
  it('builds an AgentryError with adapter + phase + code', () => {
    const err = nextAuthError({
      code: NEXT_AUTH_ERROR_CODES.SCHEMA,
      message: 'invalid strategy',
      phase: 'auth',
      suggestedFix: 'use jwt or database',
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_NEXTAUTH_SCHEMA');
    expect(err.adapter).toBe('auth-nextauth');
    expect(err.phase).toBe('auth');
    expect(err.suggestedFix).toBe('use jwt or database');
  });
});

describe('nextAuthErrorFromCause', () => {
  it('passes through an existing AgentryError', () => {
    const original = nextAuthError({
      code: NEXT_AUTH_ERROR_CODES.SCHEMA,
      message: 'bad',
      phase: 'auth',
    });
    const wrapped = nextAuthErrorFromCause('auth', original);
    expect(wrapped).toBe(original);
  });

  it('wraps a plain Error as E_NEXTAUTH_NETWORK', () => {
    const wrapped = nextAuthErrorFromCause('auth', new Error('boom'));
    expect(wrapped.code).toBe('E_NEXTAUTH_NETWORK');
    expect(wrapped.message).toMatch(/boom/);
  });

  it('wraps a non-Error cause as E_NEXTAUTH_NETWORK', () => {
    const wrapped = nextAuthErrorFromCause('auth', 'string-cause');
    expect(wrapped.code).toBe('E_NEXTAUTH_NETWORK');
  });
});
