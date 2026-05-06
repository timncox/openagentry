/**
 * Stable error codes + helpers for adapter-llm-cli.
 *
 * Subprocess-based failure surface: no HTTP-status path, but does need
 * NOT_FOUND (binary missing on PATH), AUTH (CLI rejected), TIMEOUT
 * (process exceeded timeoutMs), NONZERO (catch-all for runtime failures
 * including unknown model), PARSE (stdout malformed), SCHEMA (bad
 * config or unsupported method opts).
 *
 * @module
 */

import {
  AgentryError,
  isAgentryError,
  type AgentryErrorPhase,
} from '@openagentry/core';

export const LLM_CLI_ERROR_CODES = {
  /** Configured CLI binary not found on PATH or `binPath` does not exist. */
  NOT_FOUND: 'E_LLM_CLI_NOT_FOUND',
  /** CLI rejected with an auth-related stderr pattern (e.g., "please run claude login"). */
  AUTH: 'E_LLM_CLI_AUTH',
  /** Child process exceeded `timeoutMs`. */
  TIMEOUT: 'E_LLM_CLI_TIMEOUT',
  /** CLI exited non-zero (catch-all for runtime failures including unknown models). */
  NONZERO: 'E_LLM_CLI_NONZERO',
  /** Streaming JSON or stdout could not be parsed. */
  PARSE: 'E_LLM_CLI_PARSE',
  /** Adapter config failed validation, or method called with unsupported opts. */
  SCHEMA: 'E_LLM_CLI_SCHEMA',
} as const;

export type LlmCliErrorCode =
  (typeof LLM_CLI_ERROR_CODES)[keyof typeof LLM_CLI_ERROR_CODES];

export const ADAPTER_ID = 'llm-cli';

export interface LlmCliErrorInit {
  code: LlmCliErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix?: string;
  docs?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

/** Build an AgentryError tagged for this adapter. */
export function llmCliError(init: LlmCliErrorInit): AgentryError {
  return new AgentryError({
    code: init.code,
    message: init.message,
    phase: init.phase,
    adapter: ADAPTER_ID,
    ...(init.suggestedFix !== undefined ? { suggestedFix: init.suggestedFix } : {}),
    ...(init.docs !== undefined ? { docs: init.docs } : {}),
    ...(init.context !== undefined ? { context: init.context } : {}),
    ...(init.cause !== undefined ? { cause: init.cause } : {}),
  });
}

/**
 * Wrap an unknown thrown cause as an AgentryError. Existing AgentryErrors
 * pass through unchanged so causes that originated in `llmCliError()` keep
 * their codes.
 */
export function llmCliErrorFromCause(
  phase: AgentryErrorPhase,
  cause: unknown,
  fallbackCode: LlmCliErrorCode = LLM_CLI_ERROR_CODES.NONZERO,
): AgentryError {
  if (isAgentryError(cause)) return cause;
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
      ? cause
      : 'unknown';
  return llmCliError({
    code: fallbackCode,
    message: `CLI invocation failed: ${message}`,
    phase,
    cause,
  });
}
