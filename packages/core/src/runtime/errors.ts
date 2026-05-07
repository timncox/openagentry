/**
 * Structured error type. Every adapter operation that fails throws an
 * AgentryError so the framework — and the LLM — can introspect the failure.
 *
 * AI-friendly principle: errors carry enough info that an agent can recover
 * without asking the user.
 *
 * @module
 */

export type AgentryErrorPhase =
  | 'init'
  | 'append'
  | 'auth'
  | 'createProject'
  | 'delete'
  | 'destroyProject'
  | 'createInstance'
  | 'destroyInstance'
  | 'connectionString'
  | 'listModels'
  | 'generate'
  | 'stream'
  | 'deploy'
  | 'rollback'
  | 'setEnv'
  | 'getEnv'
  | 'attachDomain'
  | 'detachDomain'
  | 'logs'
  | 'list'
  | 'read'
  | 'write'
  | 'export'
  | 'import'
  | 'transfer'
  | 'install'
  | 'search'
  | 'send'
  | 'validate'
  | 'unknown';

export interface AgentryErrorInit {
  code: string;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix?: string;
  docs?: string;
  adapter?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export interface AgentryErrorJson {
  code: string;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix?: string;
  docs?: string;
  adapter?: string;
  context?: Record<string, unknown>;
}

export class AgentryError extends Error {
  readonly code: string;
  readonly phase: AgentryErrorPhase;
  readonly suggestedFix?: string;
  readonly docs?: string;
  readonly adapter?: string;
  readonly context?: Record<string, unknown>;

  constructor(init: AgentryErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = 'AgentryError';
    this.code = init.code;
    this.phase = init.phase;
    if (init.suggestedFix !== undefined) this.suggestedFix = init.suggestedFix;
    if (init.docs !== undefined) this.docs = init.docs;
    if (init.adapter !== undefined) this.adapter = init.adapter;
    if (init.context !== undefined) this.context = init.context;
  }

  toJSON(): AgentryErrorJson {
    const out: AgentryErrorJson = {
      code: this.code,
      message: this.message,
      phase: this.phase,
    };
    if (this.suggestedFix !== undefined) out.suggestedFix = this.suggestedFix;
    if (this.docs !== undefined) out.docs = this.docs;
    if (this.adapter !== undefined) out.adapter = this.adapter;
    if (this.context !== undefined) out.context = this.context;
    return out;
  }
}

export function isAgentryError(value: unknown): value is AgentryError {
  return value instanceof AgentryError;
}
