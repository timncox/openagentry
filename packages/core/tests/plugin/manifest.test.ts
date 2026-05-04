import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  pluginManifestSchema,
  validateManifest,
  type PluginManifest,
  type PluginType,
  type AdapterCategory,
} from '../../src/plugin/manifest.js';

const validHostAdapter: PluginManifest = {
  type: 'adapter',
  category: 'host',
  id: 'host-cloudflare',
  protocolVersion: '1',
  envVars: [
    { name: 'CLOUDFLARE_API_TOKEN', secret: true, required: true },
  ],
  fillsSlots: ['host', 'kv', 'storage'],
  requiresSlots: [],
  capabilities: {
    deploy: true,
    previewDeploys: true,
    rollback: true,
    cron: true,
    logs: 'streaming',
    domain: 'managed',
  },
  aiFriendly: {
    structuredErrors: true,
    dryRun: true,
    idempotent: ['deploy', 'setEnv', 'attachDomain'],
    queryableState: true,
  },
  llmDocs: './LLM.md',
};

describe('plugin manifest', () => {
  it('PluginType is the literal union of plugin types', () => {
    expectTypeOf<PluginType>().toEqualTypeOf<
      'scaffold' | 'adapter' | 'mcp' | 'command' | 'skill'
    >();
  });

  it('AdapterCategory includes all v0 categories', () => {
    expectTypeOf<AdapterCategory>().toEqualTypeOf<
      | 'host'
      | 'db'
      | 'auth'
      | 'email'
      | 'llm'
      | 'storage'
      | 'kv'
      | 'cron'
      | 'domain'
      | 'repo'
      | 'wiki'
      | 'billing'
      | 'push'
    >();
  });

  it('valid host adapter manifest parses', () => {
    const result = pluginManifestSchema.safeParse(validHostAdapter);
    expect(result.success).toBe(true);
  });

  it('manifest missing required field fails validation', () => {
    const bad = { ...validHostAdapter, id: undefined };
    const result = pluginManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('validateManifest throws AgentryError on invalid input', () => {
    expect(() => validateManifest({ wrong: 'shape' })).toThrow(/manifest/i);
  });

  it('validateManifest returns typed PluginManifest on valid input', () => {
    const m = validateManifest(validHostAdapter);
    expect(m.type).toBe('adapter');
    expect(m.id).toBe('host-cloudflare');
  });

  it('scaffold manifest does not require category/id format check', () => {
    const scaffold: PluginManifest = {
      type: 'scaffold',
      id: 'scaffold-website',
      protocolVersion: '1',
      envVars: [],
      fillsSlots: [],
      requiresSlots: ['host', 'db', 'repo'],
      capabilities: {},
      aiFriendly: {
        structuredErrors: true,
        dryRun: false,
        idempotent: [],
        queryableState: true,
      },
    };
    const result = pluginManifestSchema.safeParse(scaffold);
    expect(result.success).toBe(true);
  });
});
