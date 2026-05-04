import { describe, expect, it } from 'vitest';
import { defineCommand, commands, registerCommand } from '@openagentry/cli';
import { buildTools, callTool } from '../../src/tools.js';

describe('buildTools', () => {
  it('produces one Tool per registered command, prefixed agentry_', () => {
    const tools = buildTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'agentry_capabilities',
      'agentry_doctor',
      'agentry_help',
      'agentry_list',
      'agentry_version',
    ]);
  });

  it('each Tool description matches the command summary', () => {
    const tools = buildTools();
    const versionTool = tools.find((t) => t.name === 'agentry_version');
    expect(versionTool?.description).toBe(commands['version']?.summary);
  });

  it('each Tool inputSchema accepts an `args` array of strings', () => {
    const tool = buildTools().find((t) => t.name === 'agentry_version')!;
    expect(tool.inputSchema.type).toBe('object');
    const properties = tool.inputSchema.properties as Record<string, unknown>;
    const argsField = properties['args'] as { type: string; items: { type: string } };
    expect(argsField.type).toBe('array');
    expect(argsField.items.type).toBe('string');
  });

  it('reflects newly-registered commands at call time (no cached snapshot)', () => {
    registerCommand(
      defineCommand({
        name: 'tools-test-only',
        summary: 'tools.test fixture command',
        async run() {
          return 0;
        },
      }),
    );
    try {
      const tools = buildTools();
      expect(tools.find((t) => t.name === 'agentry_tools-test-only')).toBeDefined();
    } finally {
      delete commands['tools-test-only'];
    }
  });
});

describe('callTool', () => {
  it('runs agentry_version and returns parsed JSON content', async () => {
    const out = await callTool('agentry_version', { args: [] });
    expect(out.isError).toBeUndefined();
    expect(out.content).toHaveLength(1);
    const text = (out.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns isError=true with structured AgentryError JSON for an unknown command tool', async () => {
    const out = await callTool('agentry_no_such_thing', { args: [] });
    expect(out.isError).toBe(true);
    const text = (out.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.code).toBe('E_UNKNOWN_TOOL');
  });

  it('passes input.args through as positional argv after the command name', async () => {
    const out = await callTool('agentry_help', { args: ['version'] });
    expect(out.isError).toBeUndefined();
    const text = (out.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ name: 'version' });
  });

  it('forwards a non-zero exit + stderr as isError', async () => {
    // dispatch returns exit 1 for AgentryError. Use help with an unknown
    // subcommand to trigger E_UNKNOWN_COMMAND from the dispatcher.
    const out = await callTool('agentry_help', { args: ['definitely-not-a-command'] });
    expect(out.isError).toBe(true);
    const text = (out.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.code).toBe('E_UNKNOWN_COMMAND');
  });
});
