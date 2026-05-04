/**
 * `agentry capabilities` — load configured plugins, list registered adapters
 * and their declared capabilities.
 *
 * @module
 */

import { adapterCategories, isAgentryError } from '@openagentry/core';
import { defineCommand } from '../command.js';
import { locateWorkspaceRoot, readWorkspaceConfig } from '../config/workspace.js';
import { loadPlugin, registerAdaptersFromPlugin, type LoadedPlugin } from '../plugin/loader.js';

interface CategoryReport {
  adapterId: string;
  pluginName: string;
  fillsSlots: string[];
  capabilities: Record<string, boolean | string | number>;
}

/** Categories that have adapter contracts defined (shipped or in spec). */
const CONTRACTED_CATEGORIES = [
  'host',
  'db',
  'auth',
  'email',
  'llm',
  'storage',
  'domain',
  'repo',
  'wiki',
] as const;

export const capabilitiesCommand = defineCommand({
  name: 'capabilities',
  summary: 'List capabilities provided by registered adapters.',
  async run(_args, output, ctx) {
    const wsRoot = await locateWorkspaceRoot(ctx.cwd);
    const categories: Record<string, CategoryReport> = {};
    const loadErrors: Array<{ name: string; code: string; message: string }> = [];

    if (wsRoot !== undefined) {
      const cfg = await readWorkspaceConfig(wsRoot);
      const loaded: LoadedPlugin[] = [];
      for (const name of cfg.plugins) {
        try {
          const p = await loadPlugin(wsRoot, name);
          loaded.push(p);
        } catch (err) {
          const code = isAgentryError(err) ? err.code : 'E_UNKNOWN';
          const message = err instanceof Error ? err.message : String(err);
          loadErrors.push({ name, code, message });
        }
      }
      for (const p of loaded) {
        try {
          registerAdaptersFromPlugin(p);
        } catch (err) {
          const code = isAgentryError(err) ? err.code : 'E_UNKNOWN';
          const message = err instanceof Error ? err.message : String(err);
          loadErrors.push({ name: p.name, code, message });
        }
        if (p.manifest.type === 'adapter' && p.manifest.category !== undefined) {
          categories[p.manifest.category] = {
            adapterId: p.manifest.id,
            pluginName: p.name,
            fillsSlots: p.manifest.fillsSlots,
            capabilities: p.manifest.capabilities,
          };
        }
      }
    }

    output.text('Registered capabilities:');
    if (Object.keys(categories).length === 0) {
      output.text('  (none — install plugins via `agentry install <pkg>` (Plan G))');
    } else {
      for (const [cat, info] of Object.entries(categories)) {
        output.text(`  ${cat}: ${info.adapterId} (${info.pluginName})`);
      }
    }
    output.text('');
    output.text('Reserved categories (no adapter contract yet): kv, cron, billing, push.');

    output.json({
      workspaceRoot: wsRoot ?? null,
      categories,
      reservedCategories: (adapterCategories as readonly string[]).filter(
        (c) => !(CONTRACTED_CATEGORIES as readonly string[]).includes(c),
      ),
      loadErrors,
    });
    return 0;
  },
});
