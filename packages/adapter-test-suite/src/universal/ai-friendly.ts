/**
 * Universal AI-friendliness flags check.
 *
 * @module
 */

import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';

export async function checkAiFriendly(
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> {
  const start = ctx.now();
  const af = target.manifest.aiFriendly;
  const failures: string[] = [];

  if (af.structuredErrors !== true) {
    failures.push('aiFriendly.structuredErrors must be true');
  }
  if (af.queryableState !== true) {
    failures.push('aiFriendly.queryableState must be true');
  }

  if (failures.length > 0) {
    return [
      {
        id: 'ai-friendly/flags',
        status: 'fail',
        message: failures.join('; '),
        details: { aiFriendly: af },
        durationMs: Math.max(0, ctx.now() - start),
      },
    ];
  }

  return [
    {
      id: 'ai-friendly/flags',
      status: 'pass',
      details: { aiFriendly: af },
      durationMs: Math.max(0, ctx.now() - start),
    },
  ];
}
