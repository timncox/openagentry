import { describe, expect, it } from 'vitest';
import { parseArgs, type ParsedArgs } from '../src/args.js';

describe('parseArgs', () => {
  it('returns the default command when argv is empty', () => {
    expect(parseArgs([])).toEqual<ParsedArgs>({
      command: 'help',
      positional: [],
      flags: {},
      topLevelFlag: undefined,
    });
  });

  it('returns command + positional args', () => {
    expect(parseArgs(['help', 'doctor'])).toEqual<ParsedArgs>({
      command: 'help',
      positional: ['doctor'],
      flags: {},
      topLevelFlag: undefined,
    });
  });

  it('parses `--key=value` and `--key value`', () => {
    expect(parseArgs(['list', '--scope=workspace', '--limit', '5'])).toEqual<ParsedArgs>({
      command: 'list',
      positional: [],
      flags: { scope: 'workspace', limit: '5' },
      topLevelFlag: undefined,
    });
  });

  it('parses bare boolean flags', () => {
    expect(parseArgs(['doctor', '--json'])).toEqual<ParsedArgs>({
      command: 'doctor',
      positional: [],
      flags: { json: true },
      topLevelFlag: undefined,
    });
  });

  it('treats top-level --version specially', () => {
    expect(parseArgs(['--version'])).toEqual<ParsedArgs>({
      command: 'version',
      positional: [],
      flags: {},
      topLevelFlag: 'version',
    });
  });

  it('treats top-level --help specially', () => {
    expect(parseArgs(['--help'])).toEqual<ParsedArgs>({
      command: 'help',
      positional: [],
      flags: {},
      topLevelFlag: 'help',
    });
  });

  it('routes per-command --help to help subcommand', () => {
    expect(parseArgs(['doctor', '--help'])).toEqual<ParsedArgs>({
      command: 'help',
      positional: ['doctor'],
      flags: {},
      topLevelFlag: undefined,
    });
  });

  it('repeated flags overwrite (last one wins)', () => {
    expect(parseArgs(['list', '--scope=foo', '--scope=bar'])).toEqual<ParsedArgs>({
      command: 'list',
      positional: [],
      flags: { scope: 'bar' },
      topLevelFlag: undefined,
    });
  });
});
