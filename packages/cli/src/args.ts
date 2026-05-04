/**
 * argv parser. Hand-rolled to keep the dependency surface tiny and to give
 * every command consistent `--json`/`--help` handling.
 *
 * @module
 */

export type FlagValue = string | boolean;

export interface ParsedArgs {
  /** Command name. Defaults to `'help'` when no positional is given. */
  command: string;
  /** Positional args after the command name. */
  positional: string[];
  /** Long-form flags. `--foo` → `{foo:true}`; `--foo=bar` or `--foo bar` → `{foo:'bar'}`. */
  flags: Record<string, FlagValue>;
  /**
   * Set when the user passed `--version` or `--help` BEFORE any command. We
   * keep this separate from `command` so the dispatcher can render the
   * top-level help/version surface (e.g. listing all commands).
   */
  topLevelFlag: 'version' | 'help' | undefined;
}

const TOP_LEVEL_FLAGS = new Set(['--version', '--help']);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  // Top-level --version / --help handling: only when they're the first token.
  if (argv.length > 0 && TOP_LEVEL_FLAGS.has(argv[0]!)) {
    const flag = argv[0]! === '--version' ? 'version' : 'help';
    return {
      command: flag,
      positional: [],
      flags: {},
      topLevelFlag: flag,
    };
  }

  let command = 'help';
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};
  let perCommandHelp = false;

  let i = 0;
  if (argv.length > 0 && !argv[0]!.startsWith('-')) {
    command = argv[0]!;
    i = 1;
  }

  for (; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq !== -1) {
      const key = token.slice(2, eq);
      const value = token.slice(eq + 1);
      flags[key] = value;
      continue;
    }
    const key = token.slice(2);
    if (key === 'help') {
      perCommandHelp = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }

  if (perCommandHelp) {
    return {
      command: 'help',
      positional: [command, ...positional],
      flags: {},
      topLevelFlag: undefined,
    };
  }

  return {
    command,
    positional,
    flags,
    topLevelFlag: undefined,
  };
}
