/**
 * useAdapter — process-local adapter registry. Scaffolds and apps call
 * useAdapter('category') to get the runtime-resolved implementation.
 *
 * The CLI / runtime fills the registry at startup based on .agentry/config.json
 * and the workspace's installed plugins.
 *
 * @module
 */

import { AgentryError } from './errors.js';

interface AdapterMinimalShape {
  readonly category: string;
  readonly id: string;
}

const registry = new Map<string, AdapterMinimalShape>();

export function registerAdapter<T extends AdapterMinimalShape>(category: string, adapter: T): void {
  registry.set(category, adapter);
}

export function unregisterAdapter(category: string): void {
  registry.delete(category);
}

export function useAdapter<T extends AdapterMinimalShape>(category: string): T {
  const adapter = registry.get(category);
  if (adapter === undefined) {
    throw new AgentryError({
      code: 'E_NO_ADAPTER_FOR_CATEGORY',
      message: `No adapter registered for category "${category}".`,
      phase: 'init',
      suggestedFix: `agentry install @openagentry/adapter-${category}-<provider>`,
      docs: 'https://docs.openagentry.dev/errors/E_NO_ADAPTER_FOR_CATEGORY',
      context: { category, registered: Array.from(registry.keys()) },
    });
  }
  return adapter as T;
}

/** Test-only — clears the registry. Not exported from the public entry. */
export function resetRegistryForTesting(): void {
  registry.clear();
}
