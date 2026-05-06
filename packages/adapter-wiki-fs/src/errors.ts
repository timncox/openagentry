/**
 * Error codes + helpers for adapter-wiki-fs.
 *
 * @module
 */

import { AgentryError, isAgentryError, type AgentryErrorPhase } from '@openagentry/core';

export const ADAPTER_ID = 'wiki-fs' as const;

export const WIKI_FS_ERROR_CODES = {
  NOT_FOUND: 'E_WIKI_FS_NOT_FOUND',
  PERMISSION: 'E_WIKI_FS_PERMISSION',
  PARSE: 'E_WIKI_FS_PARSE',
  SCHEMA: 'E_WIKI_FS_SCHEMA',
  OUT_OF_VAULT: 'E_WIKI_FS_OUT_OF_VAULT',
  NO_PROJECT_VAULT: 'E_WIKI_FS_NO_PROJECT_VAULT',
} as const;

export type WikiFsErrorCode =
  (typeof WIKI_FS_ERROR_CODES)[keyof typeof WIKI_FS_ERROR_CODES];

export interface WikiFsErrorInit {
  code: WikiFsErrorCode;
  message: string;
  phase: AgentryErrorPhase;
  suggestedFix?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

export function wikiFsError(init: WikiFsErrorInit): AgentryError {
  const body: ConstructorParameters<typeof AgentryError>[0] = {
    code: init.code,
    message: `[${init.code}] ${init.message}`,
    phase: init.phase,
    adapter: ADAPTER_ID,
  };
  if (init.suggestedFix !== undefined) body.suggestedFix = init.suggestedFix;
  if (init.context !== undefined) body.context = init.context;
  if (init.cause !== undefined) body.cause = init.cause;
  return new AgentryError(body);
}

interface NodeFsError extends Error {
  code?: string;
  syscall?: string;
  path?: string;
}

export function fsErrorToWikiError(
  err: unknown,
  phase: AgentryErrorPhase,
  pathHint: string,
): AgentryError {
  if (isAgentryError(err)) return err;
  const fsErr = err as NodeFsError;
  const code = fsErr?.code;
  const message = fsErr?.message ?? String(err);

  if (code === 'ENOENT') {
    return wikiFsError({
      code: WIKI_FS_ERROR_CODES.NOT_FOUND,
      message: `Path not found: ${pathHint}`,
      phase,
      cause: err,
      context: { path: pathHint },
    });
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return wikiFsError({
      code: WIKI_FS_ERROR_CODES.PERMISSION,
      message: `Permission denied: ${pathHint}`,
      phase,
      suggestedFix: `Check filesystem permissions on "${pathHint}".`,
      cause: err,
      context: { path: pathHint, fsCode: code },
    });
  }
  return wikiFsError({
    code: WIKI_FS_ERROR_CODES.PARSE,
    message: `Filesystem error (${code ?? 'unknown'}) on ${pathHint}: ${message}`,
    phase,
    cause: err,
    context: { path: pathHint, fsCode: code },
  });
}
