/**
 * Universal manifest checks.
 *
 * @module
 */

import { isProtocolCompatible } from '@openagentry/core';
import type { CheckResult, LoadedTarget, SuiteCtx } from '../types.js';

export async function checkManifest(
  target: LoadedTarget,
  ctx: SuiteCtx,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  // manifest/valid — by the time we hold a LoadedTarget, the manifest already
  // parsed via @openagentry/core.validateManifest. Record the pass for visibility.
  const t1Start = ctx.now();
  checks.push({
    id: 'manifest/valid',
    status: 'pass',
    durationMs: Math.max(0, ctx.now() - t1Start),
  });

  // manifest/protocol-compatible
  const t2Start = ctx.now();
  const ok = isProtocolCompatible(target.manifest.protocolVersion);
  checks.push({
    id: 'manifest/protocol-compatible',
    status: ok ? 'pass' : 'fail',
    ...(ok
      ? {}
      : {
          message: `protocolVersion "${target.manifest.protocolVersion}" is not compatible with this core (CORE_SUPPORTS=[1]).`,
        }),
    details: { protocolVersion: target.manifest.protocolVersion },
    durationMs: Math.max(0, ctx.now() - t2Start),
  });

  return checks;
}
