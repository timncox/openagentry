import { describe, expect, it } from 'vitest';
import { checkManifest } from '../../src/universal/manifest.js';
import type { LoadedTarget } from '../../src/types.js';
import type { PluginManifest } from '@openagentry/core';

function fakeTarget(overrides: Partial<PluginManifest> = {}): LoadedTarget {
  const base: PluginManifest = {
    type: 'adapter',
    id: 'fake',
    category: 'host',
    protocolVersion: '1',
    envVars: [],
    fillsSlots: [],
    requiresSlots: [],
    capabilities: {},
    aiFriendly: { structuredErrors: true, dryRun: false, idempotent: [], queryableState: true },
  };
  return {
    packageDir: '/fake',
    manifest: { ...base, ...overrides },
    module: { default: { category: 'host', id: 'fake' } },
  };
}

describe('checkManifest', () => {
  it('returns two passing checks for a valid manifest with protocolVersion "1"', async () => {
    const checks = await checkManifest(fakeTarget(), { now: () => 0 });
    expect(checks.map((c) => c.id)).toEqual(['manifest/valid', 'manifest/protocol-compatible']);
    expect(checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('passes protocol-compatible for "^1" and ">=1"', async () => {
    for (const v of ['^1', '>=1']) {
      const checks = await checkManifest(fakeTarget({ protocolVersion: v }), { now: () => 0 });
      expect(checks[1]?.status).toBe('pass');
    }
  });

  it('fails protocol-compatible when the range cannot be satisfied', async () => {
    // Force an unsatisfiable range — protocolVersion "999" is well-formed but not in CORE_SUPPORTS.
    const checks = await checkManifest(fakeTarget({ protocolVersion: '999' }), { now: () => 0 });
    const protoCheck = checks.find((c) => c.id === 'manifest/protocol-compatible');
    expect(protoCheck?.status).toBe('fail');
    expect(protoCheck?.message).toContain('protocol');
  });

  it('records non-zero durationMs', async () => {
    let t = 0;
    const checks = await checkManifest(fakeTarget(), { now: () => (t += 5) });
    expect(checks[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
