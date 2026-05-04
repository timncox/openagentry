/**
 * Library surface for `@openagentry/cli`. Stable, additive-only re-exports
 * of the dispatcher, command registry, and core types so other packages
 * (e.g., `@openagentry/mcp`) can drive the same surface a human gets via
 * the `agentry` binary.
 *
 * The `agentry` binary itself is built from `src/cli.ts` and is NOT
 * exported from this module — bin and library are separate entry points.
 *
 * @module
 */

export { dispatch, type DispatchOptions } from './dispatcher.js';
export {
  commands,
  registerCommand,
  getCommand,
} from './commands/index.js';
export {
  defineCommand,
  type Command,
  type CommandContext,
} from './command.js';
export { parseArgs, type ParsedArgs, type FlagValue } from './args.js';
export { Output, type OutputOptions } from './output.js';
