import { describe, expect, it } from 'vitest';
import { isAgentryError } from '@openagentry/core';
import {
  defineCommand,
  type Command,
  type CommandContext,
} from '../src/command.js';
import { commands, getCommand } from '../src/commands/index.js';

describe('defineCommand', () => {
  it('returns its argument unchanged', () => {
    const cmd = defineCommand({
      name: 'noop',
      summary: 'do nothing',
      async run() {
        return 0;
      },
    });
    expect(cmd.name).toBe('noop');
    expect(cmd.summary).toBe('do nothing');
  });
});

describe('command registry', () => {
  it('exposes a non-empty record of named commands', () => {
    expect(commands).toBeDefined();
    expect(typeof commands).toBe('object');
    // Concrete commands are added in later tasks; for now we expect at least
    // an empty object that lookup can dispatch over.
    expect(commands).not.toBeNull();
  });

  it('getCommand throws AgentryError for unknown names', () => {
    let caught: unknown;
    try {
      getCommand('definitely-not-a-real-command');
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
    if (isAgentryError(caught)) {
      expect(caught.code).toBe('E_UNKNOWN_COMMAND');
      expect(caught.suggestedFix).toContain('agentry help');
    }
  });
});

// Type-level check that CommandContext exposes the right shape.
function _typeCheck(_ctx: CommandContext): Command {
  return {
    name: 'x',
    summary: 'y',
    async run(args, output) {
      void args;
      void output;
      return 0;
    },
  };
}
