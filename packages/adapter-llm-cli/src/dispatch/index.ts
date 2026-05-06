/**
 * Dispatch registry. Maps cli enum to the per-CLI dispatch module.
 *
 * @module
 */

import type { LlmGenerateOpts, LlmModel, LlmStreamChunk } from '@openagentry/core';
import { claudeDispatch } from './claude.js';

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
  // codex and gemini land in Tasks 10, 11.
  throw new Error(`Dispatch for cli="${cli}" not yet implemented.`);
}
