/**
 * Shared helpers used by every functional suite — host, storage, db, and
 * future auth/email/etc. Keeps each suite focused on its own check logic
 * rather than re-implementing timing + result shaping.
 *
 * @module
 */

import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';

export interface RunWrap<T> {
  ok: boolean;
  result?: T;
  err?: unknown;
  durationMs: number;
}

export async function timed<T>(ctx: SuiteCtx, fn: () => Promise<T>): Promise<RunWrap<T>> {
  const start = ctx.now();
  try {
    const result = await fn();
    return { ok: true, result, durationMs: Math.max(0, ctx.now() - start) };
  } catch (err) {
    return { ok: false, err, durationMs: Math.max(0, ctx.now() - start) };
  }
}

export function fail(id: string, message: string, durationMs: number): CheckResult {
  return { id, status: 'fail', message, durationMs };
}

export function pass(
  id: string,
  durationMs: number,
  details?: Record<string, unknown>,
): CheckResult {
  return details === undefined
    ? { id, status: 'pass', durationMs }
    : { id, status: 'pass', durationMs, details };
}

/**
 * Pull the default-exported adapter off a loaded target and verify it has the
 * expected category. Returns undefined if the export is missing, not an
 * object, or has the wrong category — callers turn that into a fail check.
 */
export function getAdapterDefault<T>(
  target: LoadedTarget,
  expectedCategory: string,
): T | undefined {
  const mod = target.module as { default?: unknown };
  const candidate = mod.default;
  if (candidate === null || typeof candidate !== 'object') return undefined;
  if ((candidate as { category?: string }).category !== expectedCategory) return undefined;
  return candidate as T;
}
