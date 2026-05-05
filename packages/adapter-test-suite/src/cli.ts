/**
 * Bin entry. Hand-rolled argv parser, then runSuite + reporter + exit code.
 *
 * Usage:
 *   agentry-adapter-test <category> --target <path> [--json] [--universal-only]
 *   agentry-adapter-test --help
 *
 * @module
 */

import { resolve } from 'node:path';
import { type AdapterCategory } from '@openagentry/core';
import { isAgentryError } from './internal/is-agentry-error.js';
import { runSuite } from './runner.js';
import { formatJson, formatText } from './reporter.js';
import './suites/host.js';
import './suites/storage.js';

interface ParsedCliArgs {
  help: boolean;
  category?: AdapterCategory;
  target?: string;
  json: boolean;
  universalOnly: boolean;
}

const HELP = `agentry-adapter-test <category> --target <path> [options]

Run the OpenAgentry adapter conformance suite against an adapter package.

Arguments:
  <category>         Adapter category: host, db, auth, email, storage, llm,
                     domain, repo, wiki. Must match the adapter's manifest.

Options:
  --target <path>    Absolute or relative path to the adapter package directory.
  --json             Emit machine-readable JSON instead of text.
  --universal-only   Run only the 4 universal checks; skip the functional suite.
  -h, --help         Show this help and exit.

Exit codes:
  0   All checks passed.
  1   At least one check failed (or runtime error).
  2   Bad CLI arguments.
`;

function parseArgs(argv: readonly string[]): ParsedCliArgs {
  const out: ParsedCliArgs = { help: false, json: false, universalOnly: false };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '-h' || arg === '--help') {
      out.help = true;
    } else if (arg === '--json') {
      out.json = true;
    } else if (arg === '--universal-only') {
      out.universalOnly = true;
    } else if (arg === '--target') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new CliUsageError('--target requires a value');
      }
      out.target = next;
      i += 1;
    } else if (arg.startsWith('--target=')) {
      out.target = arg.slice('--target='.length);
    } else if (arg.startsWith('-')) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 0) {
    out.category = positionals[0] as AdapterCategory;
  }
  return out;
}

class CliUsageError extends Error {}

export async function main(argv: readonly string[]): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof CliUsageError) {
      process.stderr.write(`error: ${err.message}\n\n${HELP}`);
      return 2;
    }
    throw err;
  }

  if (parsed.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (parsed.category === undefined) {
    process.stderr.write(`error: missing <category> argument\n\n${HELP}`);
    return 2;
  }
  if (parsed.target === undefined) {
    process.stderr.write(`error: --target <path> is required\n\n${HELP}`);
    return 2;
  }

  const opts: Parameters<typeof runSuite>[0] = {
    target: resolve(parsed.target),
    category: parsed.category,
    universalOnly: parsed.universalOnly,
  };

  try {
    const result = await runSuite(opts);
    process.stdout.write(parsed.json ? formatJson(result) : formatText(result));
    process.stdout.write('\n');
    return result.failed > 0 ? 1 : 0;
  } catch (err) {
    if (isAgentryError(err)) {
      if (parsed.json) {
        const json = err.toJSON !== undefined
          ? err.toJSON()
          : { code: err.code, message: err.message, phase: err.phase, suggestedFix: err.suggestedFix };
        process.stderr.write(JSON.stringify(json, null, 2) + '\n');
      } else {
        process.stderr.write(`error [${err.code}]: ${err.message}\n`);
        if (err.suggestedFix !== undefined) process.stderr.write(`  fix: ${err.suggestedFix}\n`);
      }
    } else {
      process.stderr.write(`error: ${(err as Error)?.message ?? String(err)}\n`);
    }
    return 1;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
