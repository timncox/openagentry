import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';

describe('@openagentry/core public surface', () => {
  it('exports PROTOCOL_VERSION', () => {
    expect(core.PROTOCOL_VERSION).toBe(1);
  });

  it('exports AgentryError and isAgentryError', () => {
    expect(typeof core.AgentryError).toBe('function');
    expect(typeof core.isAgentryError).toBe('function');
  });

  it('exports useAdapter, registerAdapter, unregisterAdapter', () => {
    expect(typeof core.useAdapter).toBe('function');
    expect(typeof core.registerAdapter).toBe('function');
    expect(typeof core.unregisterAdapter).toBe('function');
  });

  it('exports plugin manifest validators', () => {
    expect(typeof core.validateManifest).toBe('function');
    expect(core.pluginManifestSchema).toBeDefined();
  });

  it('exports protocol helpers', () => {
    expect(typeof core.isProtocolCompatible).toBe('function');
    expect(typeof core.parseProtocolRange).toBe('function');
    expect(Array.isArray(core.CORE_SUPPORTS)).toBe(true);
  });

  it('exports adapterCategories and pluginTypes constants', () => {
    expect(core.adapterCategories).toContain('host');
    expect(core.adapterCategories).toContain('wiki');
    expect(core.pluginTypes).toContain('adapter');
  });
});
