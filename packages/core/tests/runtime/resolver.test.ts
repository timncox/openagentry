import { describe, expect, it, beforeEach } from 'vitest';
import {
  registerAdapter,
  unregisterAdapter,
  useAdapter,
  resetRegistryForTesting,
} from '../../src/runtime/resolver.js';
import { AgentryError, isAgentryError } from '../../src/runtime/errors.js';

interface FakeHostAdapter {
  readonly category: 'host';
  readonly id: string;
  ping(): Promise<'pong'>;
}

const fakeAdapter: FakeHostAdapter = {
  category: 'host',
  id: 'fake-host',
  async ping() {
    return 'pong';
  },
};

describe('useAdapter resolver', () => {
  beforeEach(() => {
    resetRegistryForTesting();
  });

  it('resolves a registered adapter by category', () => {
    registerAdapter('host', fakeAdapter);
    const resolved = useAdapter<FakeHostAdapter>('host');
    expect(resolved.id).toBe('fake-host');
  });

  it('throws AgentryError if no adapter is registered for category', () => {
    let caught: unknown;
    try {
      useAdapter('host');
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
    if (isAgentryError(caught)) {
      expect(caught.code).toBe('E_NO_ADAPTER_FOR_CATEGORY');
      expect(caught.suggestedFix).toContain('agentry install');
    }
  });

  it('unregisterAdapter removes the registration', () => {
    registerAdapter('host', fakeAdapter);
    unregisterAdapter('host');
    expect(() => useAdapter('host')).toThrow(AgentryError);
  });

  it('register replaces an existing adapter for the category', () => {
    registerAdapter('host', fakeAdapter);
    const replacement = { ...fakeAdapter, id: 'replacement' };
    registerAdapter('host', replacement);
    const resolved = useAdapter<FakeHostAdapter>('host');
    expect(resolved.id).toBe('replacement');
  });
});
