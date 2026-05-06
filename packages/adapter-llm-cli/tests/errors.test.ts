import { describe, expect, it } from 'vitest';
import { AgentryError, isAgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  LLM_CLI_ERROR_CODES,
  llmCliError,
  llmCliErrorFromCause,
} from '../src/errors.js';

describe('errors module', () => {
  it('LLM_CLI_ERROR_CODES enumerates all six codes', () => {
    expect(Object.values(LLM_CLI_ERROR_CODES).sort()).toEqual([
      'E_LLM_CLI_AUTH',
      'E_LLM_CLI_NONZERO',
      'E_LLM_CLI_NOT_FOUND',
      'E_LLM_CLI_PARSE',
      'E_LLM_CLI_SCHEMA',
      'E_LLM_CLI_TIMEOUT',
    ]);
  });

  it('ADAPTER_ID is "llm-cli"', () => {
    expect(ADAPTER_ID).toBe('llm-cli');
  });

  it('llmCliError builds a tagged AgentryError', () => {
    const err = llmCliError({
      code: LLM_CLI_ERROR_CODES.NONZERO,
      message: 'boom',
      phase: 'generate',
    });
    expect(err).toBeInstanceOf(AgentryError);
    expect(err.code).toBe('E_LLM_CLI_NONZERO');
    expect(err.phase).toBe('generate');
    expect(err.adapter).toBe('llm-cli');
  });

  it('llmCliError preserves optional fields', () => {
    const err = llmCliError({
      code: LLM_CLI_ERROR_CODES.AUTH,
      message: 'auth',
      phase: 'generate',
      suggestedFix: 'run claude login',
      context: { stderr: 'unauthenticated' },
    });
    expect(err.suggestedFix).toBe('run claude login');
    expect(err.context).toEqual({ stderr: 'unauthenticated' });
  });

  it('llmCliErrorFromCause passes AgentryError through unchanged', () => {
    const inner = llmCliError({
      code: LLM_CLI_ERROR_CODES.SCHEMA,
      message: 'bad config',
      phase: 'init',
    });
    const wrapped = llmCliErrorFromCause('generate', inner);
    expect(wrapped).toBe(inner);
  });

  it('llmCliErrorFromCause wraps a plain Error as NONZERO', () => {
    const wrapped = llmCliErrorFromCause('generate', new Error('boom'));
    expect(isAgentryError(wrapped)).toBe(true);
    expect(wrapped.code).toBe('E_LLM_CLI_NONZERO');
    expect(wrapped.message).toContain('boom');
  });

  it('llmCliErrorFromCause respects fallbackCode', () => {
    const wrapped = llmCliErrorFromCause(
      'generate',
      new Error('timeout'),
      LLM_CLI_ERROR_CODES.TIMEOUT,
    );
    expect(wrapped.code).toBe('E_LLM_CLI_TIMEOUT');
  });

  it('llmCliErrorFromCause handles non-Error cause', () => {
    const wrapped = llmCliErrorFromCause('generate', 'string-cause');
    expect(wrapped.message).toContain('string-cause');
  });
});
