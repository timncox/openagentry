import { describe, expect, it, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

const BIN = resolve(__dirname, '..', '..', 'dist', 'index.cjs');

beforeAll(async () => {
  try {
    await stat(BIN);
  } catch {
    throw new Error(
      `${BIN} does not exist. Run \`pnpm --filter @openagentry/mcp build\` before integration tests.`,
    );
  }
});

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [BIN],
  });
  const client = new Client(
    { name: 'mcp-integration-test', version: '0.0.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function firstText(result: CallToolResult): string {
  const block = result.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in result');
  return block.text;
}

describe('agentry-mcp (integration via spawned binary)', () => {
  it('list_tools returns every agentry_ tool', async () => {
    await withClient(async (client) => {
      const result = await client.listTools();
      const names = result.tools.map((t) => t.name).sort();
      expect(names).toContain('agentry_version');
      expect(names).toContain('agentry_help');
      expect(names).toContain('agentry_doctor');
      expect(names).toContain('agentry_list');
      expect(names).toContain('agentry_capabilities');
    });
  });

  it('agentry_version returns parseable JSON', async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: 'agentry_version',
        arguments: { args: [] },
      })) as CallToolResult;
      expect(result.isError).toBeFalsy();
      const text = firstText(result);
      const parsed = JSON.parse(text);
      expect(parsed.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(typeof parsed.protocolVersion).toBe('number');
    });
  });

  it('agentry_help with positional describes the named command', async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: 'agentry_help',
        arguments: { args: ['version'] },
      })) as CallToolResult;
      const text = firstText(result);
      const parsed = JSON.parse(text);
      expect(parsed).toMatchObject({ name: 'version' });
    });
  });

  it('an unknown tool returns isError + structured E_UNKNOWN_TOOL JSON', async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: 'agentry_no_such_tool',
        arguments: {},
      })) as CallToolResult;
      expect(result.isError).toBe(true);
      const text = firstText(result);
      const parsed = JSON.parse(text);
      expect(parsed.code).toBe('E_UNKNOWN_TOOL');
    });
  });

  it('an unknown agentry subcommand inside agentry_help returns isError', async () => {
    await withClient(async (client) => {
      const result = (await client.callTool({
        name: 'agentry_help',
        arguments: { args: ['definitely-not-a-command'] },
      })) as CallToolResult;
      expect(result.isError).toBe(true);
      const text = firstText(result);
      const parsed = JSON.parse(text);
      expect(parsed.code).toBe('E_UNKNOWN_COMMAND');
    });
  });
});
