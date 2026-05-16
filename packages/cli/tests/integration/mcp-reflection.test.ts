// packages/cli/tests/integration/mcp-reflection.test.ts
import { describe, expect, it } from 'vitest';
import { commands } from '../../src/commands/index.js';

describe('MCP reflection — host commands surface as tools', () => {
  const expectedNames = [
    'host:deploy',
    'host:set-env',
    'host:get-env',
    'host:attach-domain',
    'host:logs',
  ];

  for (const name of expectedNames) {
    it(`registers "${name}" command`, () => {
      const cmd = commands[name];
      expect(cmd).toBeDefined();
      if (cmd === undefined) throw new Error(`command "${name}" missing`);
      expect(cmd.name).toBe(name);
      expect(typeof cmd.summary).toBe('string');
      expect(cmd.summary.length).toBeGreaterThan(0);
      expect(typeof cmd.run).toBe('function');
    });
  }
});
