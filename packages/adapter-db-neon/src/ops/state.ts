/**
 * exportState / importState. importState is idempotent (find-by-slug first).
 *
 * Phases 'export' and 'import' ARE in core's AgentryErrorPhase union — no
 * cast workaround needed for this file.
 *
 * @module
 */

import type {
  DatabaseInstance,
  DatabaseStateBundle,
} from '@openagentry/core';
import type { NeonApi } from '../client.js';
import { createInstance, getInstanceBySlug } from './instances.js';

export async function exportState(
  api: NeonApi,
  instance: DatabaseInstance,
): Promise<DatabaseStateBundle> {
  // Re-fetch the project to confirm it still exists (also surfaces 404 if deleted).
  await api.request('GET', `/projects/${instance.dbId}`, { phase: 'export' });
  const asOf = new Date().toISOString();
  return {
    version: 1,
    instance,
    snapshotRef: `neon:project:${instance.dbId}:as-of:${asOf}`,
  };
}

export async function importState(
  api: NeonApi,
  bundle: DatabaseStateBundle,
): Promise<DatabaseInstance> {
  const existing = await getInstanceBySlug(api, bundle.instance.slug, 'import');
  if (existing !== null) return existing;
  return createInstance(api, {
    name: bundle.instance.name,
    slug: bundle.instance.slug,
    engine: bundle.instance.engine,
    region: bundle.instance.region,
  });
}
