/**
 * SpawnFn injection point + default spawn wrapper + binary path resolution.
 *
 * SpawnFn is the public injection type used by tests to inject a fake
 * subprocess; default callers use `defaultSpawn` which wraps Node's
 * child_process.spawn. resolveBinary takes the configured `cli` and
 * optional `binPath` and returns an absolute path; throws
 * E_LLM_CLI_NOT_FOUND if the binary isn't found.
 *
 * @module
 */

import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter } from 'node:path';
import { llmCliError, LLM_CLI_ERROR_CODES } from './errors.js';

export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: { env?: Record<string, string> },
) => ChildProcess;

/** Default spawn wrapper — uses Node's child_process.spawn with stdio: 'pipe'. */
export const defaultSpawn: SpawnFn = (cmd, args, opts) => {
  const spawnOpts: SpawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    env:
      opts.env !== undefined
        ? { ...process.env, ...opts.env }
        : process.env,
  };
  return spawn(cmd, args, spawnOpts);
};

/**
 * Resolve a binary name to an absolute path. If `binPath` is set, returns
 * it directly (after existsSync check). Otherwise walks $PATH looking for
 * an executable named `cli`. Throws E_LLM_CLI_NOT_FOUND if nothing found.
 */
export function resolveBinary(cli: string, binPath?: string): string {
  if (binPath !== undefined) {
    if (!existsSync(binPath)) {
      throw llmCliError({
        code: LLM_CLI_ERROR_CODES.NOT_FOUND,
        message: `binPath does not exist: ${binPath}`,
        phase: 'init',
        suggestedFix: `Set binPath to an existing file, or remove binPath to fall back to PATH lookup of "${cli}".`,
      });
    }
    return binPath;
  }

  const pathEnv = process.env['PATH'] ?? '';
  const pathDirs = pathEnv.split(delimiter).filter((d) => d.length > 0);
  for (const dir of pathDirs) {
    const candidate = `${dir}/${cli}`;
    if (existsSync(candidate)) return candidate;
  }

  throw llmCliError({
    code: LLM_CLI_ERROR_CODES.NOT_FOUND,
    message: `Binary "${cli}" not found on PATH.`,
    phase: 'init',
    suggestedFix: `Install the ${cli} CLI, or set OA_LLM_CLI_BIN / config.binPath to an explicit path.`,
    context: { cli, pathDirCount: pathDirs.length },
  });
}
