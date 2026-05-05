import { describe, expect, it } from 'vitest';
import type {
  CheckResult,
  SuiteResult,
  RunOpts,
  LoadedTarget,
  SuiteCtx,
} from '../src/types.js';
import type { AdapterCategory, PluginManifest } from '@openagentry/core';

describe('adapter-test-suite types', () => {
  it('CheckResult has the documented shape', () => {
    const c: CheckResult = {
      id: 'manifest/valid',
      status: 'pass',
      durationMs: 12,
    };
    expect(c.id).toBe('manifest/valid');
    expect(c.status).toBe('pass');
  });

  it('SuiteResult rolls up counts and lists checks', () => {
    const r: SuiteResult = {
      adapter: { id: 'fake', category: 'host', version: '0.0.0' },
      passed: 1,
      failed: 0,
      skipped: 0,
      total: 1,
      checks: [{ id: 'manifest/valid', status: 'pass', durationMs: 1 }],
      startedAt: '2026-05-04T00:00:00Z',
      finishedAt: '2026-05-04T00:00:01Z',
    };
    expect(r.checks).toHaveLength(1);
  });

  it('RunOpts requires target, accepts optional category and universalOnly', () => {
    const a: RunOpts = { target: '/abs/path' };
    const b: RunOpts = { target: '/abs/path', category: 'host', universalOnly: true };
    expect(a.target).toBe('/abs/path');
    expect(b.universalOnly).toBe(true);
  });

  it('LoadedTarget exposes packageDir, manifest, module', () => {
    const lt: LoadedTarget = {
      packageDir: '/abs/pkg',
      manifest: {
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
        },
      } satisfies PluginManifest,
      module: { default: { category: 'host' as AdapterCategory, id: 'fake' } },
    };
    expect(lt.manifest.id).toBe('fake');
  });

  it('SuiteCtx carries a now() function so checks can stamp durations deterministically', () => {
    const ctx: SuiteCtx = { now: () => 1000 };
    expect(ctx.now()).toBe(1000);
  });
});
