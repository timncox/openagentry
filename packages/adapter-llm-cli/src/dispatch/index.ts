/**
 * Dispatch registry. Maps cli enum to the per-CLI dispatch module.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmModel, LlmStreamChunk } from '@openagentry/core';
import { llmCliError, LLM_CLI_ERROR_CODES } from '../errors.js';
import { claudeDispatch } from './claude.js';
import { codexDispatch } from './codex.js';
import { geminiDispatch } from './gemini.js';

export interface CliDispatch {
  bin: 'claude' | 'codex' | 'gemini';
  models(): LlmModel[];
  buildArgv(prompt: string, opts: LlmGenerateOpts): string[];
  parseStreamChunk(line: string): LlmStreamChunk | null;
  parseFinalUsage(
    stdout: string,
    stderr: string,
  ): { inputTokens: number; outputTokens: number } | undefined;
  authErrorPattern: RegExp;
}

export function getDispatch(cli: 'claude' | 'codex' | 'gemini'): CliDispatch {
  if (cli === 'claude') return claudeDispatch;
  if (cli === 'codex') return codexDispatch;
  if (cli === 'gemini') return geminiDispatch;
  throw llmCliError({
    code: LLM_CLI_ERROR_CODES.SCHEMA,
    message: `Unknown cli="${cli as string}". Use one of: claude, codex, gemini.`,
    phase: 'init',
  });
}
