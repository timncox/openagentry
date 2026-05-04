/**
 * MCP server factory. Wires the cli-derived tool list and call-handler into
 * an @modelcontextprotocol/sdk Server. Transport hookup is a separate
 * concern (see src/index.ts).
 *
 * @module
 *
 * ## SDK adaptation notes (verified against @modelcontextprotocol/sdk@1.29.0)
 *
 * - `ListToolsRequestSchema` and `CallToolRequestSchema` both exist in
 *   `@modelcontextprotocol/sdk/types.js` — no adaptation needed.
 * - `setRequestHandler` infers the full request type from the schema (including
 *   the `extra` RequestHandlerExtra second arg) and requires the return value to
 *   be assignable to `ServerResult`. Passing a simplified handler type causes a
 *   TypeScript error. We work around this by wrapping both inner handlers in
 *   explicit `server.setRequestHandler(...)` lambdas that satisfy the SDK's type
 *   contract, while exposing clean test-callable versions via `_listToolsHandler`
 *   and `_callToolHandler` on the returned object.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { buildTools, callTool } from './tools.js';

const NAME = 'agentry-mcp';
const VERSION = '0.1.0-alpha.0';

type ListToolsHandler = () => Promise<ListToolsResult>;
type CallToolHandler = (req: {
  params: { name: string; arguments?: Record<string, unknown> };
}) => Promise<CallToolResult>;

export interface CreatedServer {
  /** The SDK Server. Use .connect(transport) to start. */
  server: Server;
  /** Test-only: directly invoke the list_tools handler. */
  _listToolsHandler: ListToolsHandler;
  /** Test-only: directly invoke the call_tool handler. */
  _callToolHandler: CallToolHandler;
  /** Test-only: server identity. */
  _serverName: string;
}

export function createServer(): CreatedServer {
  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  const listTools: ListToolsHandler = async () => ({
    tools: buildTools() as ListToolsResult['tools'],
  });

  const callToolHandler: CallToolHandler = async (req) => {
    const argsInput = (req.params.arguments ?? {}) as { args?: string[] };
    // callTool returns our internal ToolResult which is structurally identical to
    // the SDK's CallToolResult (content array + optional isError). Cast to satisfy
    // the SDK's type boundary.
    return callTool(req.params.name, { args: argsInput.args ?? [] }) as Promise<CallToolResult>;
  };

  // The SDK's setRequestHandler infers its handler type from the Zod schema,
  // requiring the full (request, extra) => ServerResult signature. We wrap our
  // clean inner handlers to satisfy that contract without coupling the test
  // helpers to SDK internals.
  server.setRequestHandler(ListToolsRequestSchema, () => listTools());
  server.setRequestHandler(CallToolRequestSchema, (req) =>
    callToolHandler(req as Parameters<CallToolHandler>[0]),
  );

  return {
    server,
    _listToolsHandler: listTools,
    _callToolHandler: callToolHandler,
    _serverName: NAME,
  };
}
