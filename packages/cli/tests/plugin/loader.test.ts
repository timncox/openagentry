import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isAgentryError } from '@openagentry/core';
import {
  resetRegistryForTesting,
} from '../../../core/src/runtime/resolver.js';
// Note: `resetRegistryForTesting` is a test-only export from @openagentry/core.
// We import it via relative path because it's intentionally not in the public barrel.
import { loadPlugin, registerAdaptersFromPlugin } from '../../src/plugin/loader.js';
import { useAdapter } from '@openagentry/core';

const FIXTURE = resolve(__dirname, '../fixtures/fake-host-adapter');

let workspaceRoot: string;
beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'agentry-load-'));
  // Stage the fixture under the workspace's node_modules so the loader's
  // require.resolve from `workspaceRoot` finds it.
  const target = join(workspaceRoot, 'node_modules', 'fake-host-adapter');
  await mkdir(target, { recursive: true });
  await cp(FIXTURE, target, { recursive: true });
  resetRegistryForTesting();
});
afterEach(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('loadPlugin', () => {
  it('resolves the package, imports it, validates manifest', async () => {
    const loaded = await loadPlugin(workspaceRoot, 'fake-host-adapter');
    expect(loaded.manifest.type).toBe('adapter');
    expect(loaded.manifest.category).toBe('host');
    expect(loaded.manifest.id).toBe('fake-host');
    // The export shape: default-export is the adapter
    expect((loaded.module as { default: { id: string } }).default.id).toBe('fake-host');
  });

  it('throws AgentryError E_PLUGIN_NOT_FOUND when package is not installed', async () => {
    let caught: unknown;
    try {
      await loadPlugin(workspaceRoot, '@openagentry/no-such-plugin');
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
    if (isAgentryError(caught)) {
      expect(caught.code).toBe('E_PLUGIN_NOT_FOUND');
      expect(caught.suggestedFix).toContain('install');
    }
  });
});

describe('registerAdaptersFromPlugin', () => {
  it('registers an adapter with @openagentry/core', async () => {
    const loaded = await loadPlugin(workspaceRoot, 'fake-host-adapter');
    registerAdaptersFromPlugin(loaded);
    const a = useAdapter<{ id: string; category: 'host' }>('host');
    expect(a.id).toBe('fake-host');
  });

  it('registers an adapter from a tsup-style CJS bundle (double-default interop)', async () => {
    // tsup's __toCommonJS output puts the adapter at module.exports.default,
    // so dynamic import gives mod.default = entire exports, mod.default.default = adapter.
    const FIXTURE_TSUP = resolve(__dirname, '../fixtures/fake-tsup-adapter');
    const target = join(workspaceRoot, 'node_modules', 'fake-tsup-adapter');
    await mkdir(target, { recursive: true });
    await cp(FIXTURE_TSUP, target, { recursive: true });

    const loaded = await loadPlugin(workspaceRoot, 'fake-tsup-adapter');
    registerAdaptersFromPlugin(loaded);
    const a = useAdapter<{ id: string; category: 'host' }>('host');
    expect(a.id).toBe('fake-tsup-host');
  });
});
