/**
 * `agentry-mcp` server entry. Connects the meta-MCP server to a stdio
 * transport and runs forever (until the parent closes stdin or signals).
 *
 * @module
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

export const SERVER_NAME = 'agentry-mcp' as const;

async function main(): Promise<number> {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The server runs until the transport closes (parent disconnects stdin).
  // We don't return until that happens.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${SERVER_NAME}: fatal: ${String(err)}\n`);
      process.exit(2);
    },
  );
}
