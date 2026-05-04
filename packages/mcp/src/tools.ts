/**
 * Tool registry for the meta-MCP server. Reflects the cli's `commands`
 * registry into MCP `Tool` descriptors. The registry is queried fresh on
 * every `buildTools()` call so plugin-registered commands are picked up
 * without a server restart (relevant once Plan G lands install/auth).
 *
 * @module
 */

import { commands } from '@openagentry/cli';
import { runDispatch } from './capture.js';

/** Convert a cli command name into its MCP tool name. */
export function toolNameFor(commandName: string): string {
  return `agentry_${commandName}`;
}

/** Convert an MCP tool name back to its cli command name (or undefined). */
export function commandNameFor(toolName: string): string | undefined {
  if (!toolName.startsWith('agentry_')) return undefined;
  return toolName.slice('agentry_'.length);
}

/**
 * MCP Tool descriptor. We define the minimal shape we emit so this file is
 * decoupled from the SDK's Tool type — the server.ts file maps to the SDK's
 * type at the boundary.
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    additionalProperties: false;
  };
}

export interface ToolInput {
  args?: readonly string[];
}

export interface ToolResultContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolResultContent[];
  isError?: true;
}

const ARGS_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
  description:
    'CLI-style positional + flag argv tail (everything after `agentry <command>`). Example: ["--scope", "workspace"].',
} as const;

export function buildTools(): ToolDescriptor[] {
  return Object.values(commands)
    .map<ToolDescriptor>((cmd) => ({
      name: toolNameFor(cmd.name),
      description: cmd.summary,
      inputSchema: {
        type: 'object',
        properties: { args: ARGS_SCHEMA },
        additionalProperties: false,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Run an MCP tool call. Always invokes the cli with `--json` so the captured
 * stdout/stderr is machine-readable.
 */
export async function callTool(
  toolName: string,
  input: ToolInput,
): Promise<ToolResult> {
  const cmdName = commandNameFor(toolName);
  if (cmdName === undefined || commands[cmdName] === undefined) {
    const payload = {
      code: 'E_UNKNOWN_TOOL',
      message: `Unknown tool "${toolName}".`,
      phase: 'init',
      suggestedFix:
        'Call list_tools to enumerate available tools (every tool name starts with `agentry_`).',
      context: { toolName, available: Object.keys(commands).map(toolNameFor).sort() },
    };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    };
  }

  const argv = [cmdName, ...(input.args ?? []), '--json'];
  const r = await runDispatch(argv);

  if (r.exitCode !== 0) {
    return {
      isError: true,
      content: [
        { type: 'text', text: r.stderr.length > 0 ? r.stderr : r.stdout },
      ],
    };
  }

  return {
    content: [{ type: 'text', text: r.stdout }],
  };
}
