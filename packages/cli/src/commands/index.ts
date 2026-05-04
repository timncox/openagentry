/**
 * Command registry. Subsequent tasks add commands by importing them here
 * and merging them into the `commands` record.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
import type { Command } from '../command.js';

/**
 * The registered commands. Keys are command names (as typed: `agentry list`).
 * Tasks 8–12 populate this map.
 */
export const commands: Record<string, Command> = {};

export function registerCommand(cmd: Command): void {
  commands[cmd.name] = cmd;
}

export function getCommand(name: string): Command {
  const found = commands[name];
  if (found === undefined) {
    throw new AgentryError({
      code: 'E_UNKNOWN_COMMAND',
      message: `Unknown command "${name}".`,
      phase: 'init',
      suggestedFix: `agentry help`,
      context: { command: name, available: Object.keys(commands).sort() },
    });
  }
  return found;
}
