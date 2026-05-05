/**
 * Duck-type guard for AgentryError that works across CJS/ESM module
 * boundaries.
 *
 * @openagentry/core's `isAgentryError` uses `instanceof`, which fails when
 * the suite (ESM) and a fixture/adapter (CJS) load `@openagentry/core` via
 * different module instances — Node loads `dist/index.js` and `dist/index.cjs`
 * separately and creates two distinct `AgentryError` classes. This guard
 * matches the structural contract instead, so cross-realm errors verify
 * correctly.
 *
 * @module
 */

export interface AgentryErrorLike {
  name: 'AgentryError';
  code: string;
  phase: string;
}

export function isAgentryError(value: unknown): value is AgentryErrorLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { name?: unknown }).name === 'AgentryError' &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { phase?: unknown }).phase === 'string'
  );
}
