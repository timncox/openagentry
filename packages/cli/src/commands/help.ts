/**
 * `agentry help [command]` — list commands or describe a single one.
 *
 * @module
 */

import { defineCommand } from '../command.js';
import { commands, getCommand } from './index.js';

export const helpCommand = defineCommand({
  name: 'help',
  summary: 'Show available commands or detailed help for one.',
  async run(args, output) {
    const target = args.positional[0];
    if (target !== undefined && target !== '') {
      // Throws AgentryError E_UNKNOWN_COMMAND if not found — propagates up.
      const cmd = getCommand(target);
      output.text(`${cmd.name} — ${cmd.summary}`);
      output.json({ name: cmd.name, summary: cmd.summary });
      return 0;
    }

    const list = Object.values(commands)
      .map((c) => ({ name: c.name, summary: c.summary }))
      .sort((a, b) => a.name.localeCompare(b.name));

    output.text('Usage: agentry <command> [options]');
    output.text('');
    output.text('Commands:');
    const width = list.reduce((w, c) => Math.max(w, c.name.length), 0);
    for (const c of list) {
      output.text(`  ${c.name.padEnd(width)}  ${c.summary}`);
    }
    output.text('');
    output.text('Global options:');
    output.text('  --json     Emit machine-readable JSON.');
    output.text('  --help     Show help for a command (e.g., `agentry version --help`).');
    output.text('  --version  Print agentry version and exit.');

    output.json({ commands: list });
    return 0;
  },
});
