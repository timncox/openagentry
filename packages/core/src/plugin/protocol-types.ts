/**
 * Type-only export for ProtocolVersion. Separate file because some downstream
 * tools choke on `export type` of a constant — this gives them a clean place
 * to import the type alone.
 *
 * @module
 */

import type { PROTOCOL_VERSION } from './protocol.js';
export type ProtocolVersion = typeof PROTOCOL_VERSION;
