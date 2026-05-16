/**
 * Dispatcher: parse argv, look up a command, run it under a top-level
 * try/catch that converts thrown errors into formatted output + exit codes.
 *
 * @module
 */

import { AgentryError, isAgentryError } from '@openagentry/core';
import type { Writable } from 'node:stream';
import { parseArgs } from './args.js';
import { Output } from './output.js';
import { getCommand } from './commands/index.js';
import { ensureHostAdapter } from './runtime/host-bootstrap.js';

export interface DispatchOptions {
  stdout?: Writable;
  stderr?: Writable;
  cwd?: string;
}

export async function dispatch(
  argv: readonly string[],
  opts: DispatchOptions = {},
): Promise<number> {
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const cwd = opts.cwd ?? process.cwd();

  const parsed = parseArgs(argv);
  const wantsJson = parsed.flags['json'] === true || parsed.flags['json'] === 'true';
  const output = new Output({ mode: wantsJson ? 'json' : 'text', stdout, stderr });

  try {
    await ensureHostAdapter(process.env);
    const cmd = getCommand(parsed.command);
    return await cmd.run(parsed, output, { cwd, env: process.env });
  } catch (err) {
    output.error(err);
    if (isAgentryError(err)) return 1;
    if (err instanceof AgentryError) return 1;
    return 2;
  }
}
