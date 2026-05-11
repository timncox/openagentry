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
    // categories[cat] = the *default* adapter (last registered, mirrors useAdapter).
    const categories: Record<string, CategoryReport> = {};
    // adaptersByCategory[cat] = ALL adapters declared for that category, in
    // workspace.json order. Multiple adapters per category is legal — the
    // last one becomes the default, but consumers can still discover the rest.
    const adaptersByCategory: Record<string, CategoryReport[]> = {};
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
          const report: CategoryReport = {
            adapterId: p.manifest.id,
            pluginName: p.name,
            fillsSlots: p.manifest.fillsSlots,
            capabilities: p.manifest.capabilities,
          };
          categories[p.manifest.category] = report;
          (adaptersByCategory[p.manifest.category] ??= []).push(report);
        }
      }
    }

    output.text('Registered capabilities:');
    if (Object.keys(categories).length === 0) {
      output.text('  (none — `agentry init <pkg> [<pkg>...]` to register plugins, then `npm install` them)');
    } else {
      for (const [cat, info] of Object.entries(categories)) {
        const all = adaptersByCategory[cat] ?? [];
        if (all.length > 1) {
          output.text(`  ${cat}: ${info.adapterId} (${info.pluginName}) — default; ${all.length} adapters available:`);
          for (const a of all) {
            const marker = a === info ? '*' : ' ';
            output.text(`    ${marker} ${a.adapterId} (${a.pluginName})`);
          }
        } else {
          output.text(`  ${cat}: ${info.adapterId} (${info.pluginName})`);
        }
      }
    }
    output.text('');
    output.text('Reserved categories (no adapter contract yet): kv, cron, billing, push.');

    output.json({
      workspaceRoot: wsRoot ?? null,
      categories,
      adaptersByCategory,
      reservedCategories: (adapterCategories as readonly string[]).filter(
        (c) => !(CONTRACTED_CATEGORIES as readonly string[]).includes(c),
      ),
      loadErrors,
    });
    return 0;
  },
});
