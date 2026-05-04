/**
 * Capture helper. Runs the cli's `dispatch` with in-memory Writable streams
 * so the MCP server can return the captured output as MCP content rather
 * than letting it leak to the host stdio.
 *
 * @module
 */

import { Writable } from 'node:stream';
import { dispatch, type DispatchOptions } from '@openagentry/cli';

export interface RunResult {
  /** Captured stdout as a UTF-8 string. */
  stdout: string;
  /** Captured stderr as a UTF-8 string. */
  stderr: string;
  /** The exit code dispatch returned. */
  exitCode: number;
}

export interface RunOptions {
  /** Working directory for the command. Defaults to process.cwd(). */
  cwd?: string;
}

/**
 * Run a single `agentry <argv...>` invocation and collect stdout/stderr/exit.
 * Does NOT call `process.exit` — the dispatcher already returns an exit code,
 * and the caller decides what to do with it.
 */
export async function runDispatch(
  argv: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const stdout = new Writable({
    write(chunk, _enc, cb) {
      stdoutChunks.push(String(chunk));
      cb();
    },
  });
  const stderr = new Writable({
    write(chunk, _enc, cb) {
      stderrChunks.push(String(chunk));
      cb();
    },
  });

  const dispatchOpts: DispatchOptions = {
    stdout,
    stderr,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
  };

  const exitCode = await dispatch(argv, dispatchOpts);

  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
    exitCode,
  };
}
