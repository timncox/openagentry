/**
 * Protocol version helpers. Plugins declare which protocol version they
 * speak; cores declare which they support.
 *
 * @module
 */

import { AgentryError } from '../runtime/errors.js';

/** The protocol version implemented by this version of @openagentry/core. */
export const PROTOCOL_VERSION = 1 as const;

/**
 * All protocol versions this core understands. During a deprecation window
 * a core may support N and N+1 simultaneously.
 */
export const CORE_SUPPORTS: readonly number[] = [1] as const;

/**
 * Parse a plugin's `protocolVersion` field. Accepts:
 * - exact: "1"
 * - caret: "^1"
 * - range: ">=1"
 *
 * Returns the list of major versions that satisfy the range. (Protocol
 * versions are integers; caret/>= behave the same here at v1 — this lays
 * groundwork for v2+ when major-version tolerance gets useful.)
 */
export function parseProtocolRange(input: string): number[] {
  const exact = /^(\d+)$/.exec(input);
  if (exact?.[1] !== undefined) return [Number(exact[1])];

  const caret = /^\^(\d+)$/.exec(input);
  if (caret?.[1] !== undefined) return [Number(caret[1])];

  const gte = /^>=(\d+)$/.exec(input);
  if (gte?.[1] !== undefined) {
    const min = Number(gte[1]);
    return CORE_SUPPORTS.filter((v) => v >= min);
  }

  throw new AgentryError({
    code: 'E_PROTOCOL_RANGE_MALFORMED',
    message: `Cannot parse protocol range "${input}". Use "1", "^1", or ">=1".`,
    phase: 'validate',
  });
}

export function isProtocolCompatible(pluginRequires: string): boolean {
  let acceptable: number[];
  try {
    acceptable = parseProtocolRange(pluginRequires);
  } catch {
    return false;
  }
  return acceptable.some((v) => CORE_SUPPORTS.includes(v));
}
