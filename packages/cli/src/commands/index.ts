/**
 * Command registry. Side-effect imports register each command at module load.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
import type { Command } from '../command.js';
import { versionCommand } from './version.js';
import { helpCommand } from './help.js';
import { doctorCommand } from './doctor.js';
import { listCommand } from './list.js';
import { capabilitiesCommand } from './capabilities.js';
import { initCommand } from './init.js';
import { hostDeployCommand } from './host-deploy.js';
import { hostSetEnvCommand } from './host-set-env.js';
import { hostGetEnvCommand } from './host-get-env.js';
import { hostAttachDomainCommand } from './host-attach-domain.js';
import { hostLogsCommand } from './host-logs.js';

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
registerCommand(doctorCommand);
registerCommand(listCommand);
registerCommand(capabilitiesCommand);
registerCommand(initCommand);
registerCommand(hostDeployCommand);
registerCommand(hostSetEnvCommand);
registerCommand(hostGetEnvCommand);
registerCommand(hostAttachDomainCommand);
registerCommand(hostLogsCommand);
