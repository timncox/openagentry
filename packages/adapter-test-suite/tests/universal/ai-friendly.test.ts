import { describe, expect, it } from 'vitest';
import { checkAiFriendly } from '../../src/universal/ai-friendly.js';
import type { LoadedTarget } from '../../src/types.js';
import type { PluginManifest } from '@openagentry/core';

function targetWith(aiFriendly: Partial<PluginManifest['aiFriendly']>): LoadedTarget {
  const manifest: PluginManifest = {
    type: 'adapter',
    id: 'fake',
    category: 'host',
    protocolVersion: '1',
    envVars: [],
    fillsSlots: [],
    requiresSlots: [],
    capabilities: {},
    aiFriendly: {
      structuredErrors: true,
      dryRun: false,
      idempotent: [],
      queryableState: true,
      ...aiFriendly,
    },
  };
  return { packageDir: '/fake', manifest, module: {} };
}

describe('checkAiFriendly', () => {
  it('passes when structuredErrors and queryableState are both true', async () => {
    const checks = await checkAiFriendly(targetWith({}), { now: () => 0 });
    expect(checks).toHaveLength(1);
    expect(checks[0]?.id).toBe('ai-friendly/flags');
    expect(checks[0]?.status).toBe('pass');
  });

  it('fails when structuredErrors is false', async () => {
    const checks = await checkAiFriendly(
      targetWith({ structuredErrors: false }),
      { now: () => 0 },
    );
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.message).toContain('structuredErrors');
  });

  it('fails when queryableState is false', async () => {
    const checks = await checkAiFriendly(
      targetWith({ queryableState: false }),
      { now: () => 0 },
    );
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.message).toContain('queryableState');
  });

  it('reports both flag failures together', async () => {
    const checks = await checkAiFriendly(
      targetWith({ structuredErrors: false, queryableState: false }),
      { now: () => 0 },
    );
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.message).toContain('structuredErrors');
    expect(checks[0]?.message).toContain('queryableState');
  });
});
