/**
 * Command registry. Side-effect imports register each command at module load.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
import type { Command } from '../command.js';
import { versionCommand } from './version.js';
import { helpCommand } from './help.js';

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

// Registrations
registerCommand(versionCommand);
registerCommand(helpCommand);
