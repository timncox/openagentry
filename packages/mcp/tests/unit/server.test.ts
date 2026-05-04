import { describe, expect, it } from 'vitest';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from '../../src/server.js';

describe('createServer', () => {
  it('returns a server with name + version metadata', () => {
    const s = createServer();
    expect(s).toBeDefined();
    expect(s._serverName).toBe('agentry-mcp');
  });

  it('handles list_tools by returning every agentry_ tool', async () => {
    const s = createServer();
    const result = await s._listToolsHandler();
    const names = (result.tools as Array<{ name: string }>).map((t) => t.name).sort();
    expect(names).toContain('agentry_version');
    expect(names).toContain('agentry_help');
  });

  it('handles call_tool by routing to callTool', async () => {
    const s = createServer();
    const result = await s._callToolHandler({
      params: { name: 'agentry_version', arguments: { args: [] } },
    });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { type: 'text'; text: string }).type).toBe('text');
  });

  it('schemas import successfully (sanity that the SDK is usable)', () => {
    expect(ListToolsRequestSchema).toBeDefined();
    expect(CallToolRequestSchema).toBeDefined();
  });
});
