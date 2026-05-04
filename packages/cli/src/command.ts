/**
 * Command contract. Every CLI command implements this interface.
 *
 * @module
 */

import type { Output } from './output.js';
import type { ParsedArgs } from './args.js';

export interface CommandContext {
  /** Working directory the command was invoked from. */
  cwd: string;
  /** Resolved environment variables (a copy of process.env, unmodified). */
  env: Readonly<Record<string, string | undefined>>;
}

export interface Command {
  /** The command name as typed: `agentry <name>`. */
  readonly name: string;
  /** One-line summary used in `agentry help`. */
  readonly summary: string;
  /**
   * Execute the command. Return the desired exit code (0 for success,
   * 1 for "operation failed cleanly", 2 for "unexpected internal error").
   */
  run(args: ParsedArgs, output: Output, ctx: CommandContext): Promise<number>;
}

/**
 * Identity helper that pins the type. Keeps command files concise without
 * losing inference on `args`/`output` parameters.
 */
export function defineCommand(cmd: Command): Command {
  return cmd;
}
