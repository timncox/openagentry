/**
 * `agentry list` — list plugins declared in the workspace.
 *
 * @module
 */

import { isAgentryError } from '@openagentry/core';
import { defineCommand } from '../command.js';
import { locateWorkspaceRoot, readWorkspaceConfig } from '../config/workspace.js';
import { loadPlugin } from '../plugin/loader.js';

interface PluginEntry {
  name: string;
  loaded: boolean;
  type?: string;
  category?: string;
  id?: string;
  error?: { code: string; message: string };
}

export const listCommand = defineCommand({
  name: 'list',
  summary: 'List plugins declared in the active workspace.',
  async run(_args, output, ctx) {
    const wsRoot = await locateWorkspaceRoot(ctx.cwd);
    if (wsRoot === undefined) {
      output.text('No workspace configured. Run `agentry init` (Plan G) to start one.');
      output.json({ plugins: [], workspaceRoot: null });
      return 0;
    }

    const cfg = await readWorkspaceConfig(wsRoot);
    const plugins: PluginEntry[] = [];

    for (const name of cfg.plugins) {
      try {
        const loaded = await loadPlugin(wsRoot, name);
        plugins.push({
          name,
          loaded: true,
          type: loaded.manifest.type,
          ...(loaded.manifest.category !== undefined ? { category: loaded.manifest.category } : {}),
          id: loaded.manifest.id,
        });
      } catch (err) {
        const code = isAgentryError(err) ? err.code : 'E_UNKNOWN';
        const message = err instanceof Error ? err.message : String(err);
        plugins.push({ name, loaded: false, error: { code, message } });
      }
    }

    if (plugins.length === 0) {
      output.text('No plugins configured for this workspace.');
    } else {
      for (const p of plugins) {
        const status = p.loaded ? 'loaded' : `error (${p.error?.code})`;
        const extra = p.loaded
          ? ` ${p.type}${p.category !== undefined ? ` · ${p.category}` : ''} · ${p.id ?? ''}`
          : '';
        output.text(`${p.name} — ${status}${extra}`);
      }
    }
    output.json({ workspaceRoot: wsRoot, plugins });
    return 0;
  },
});
