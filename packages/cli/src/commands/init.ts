/**
 * `agentry init` — create `.agentry/workspace.json` in the current directory.
 *
 * @module
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentryError } from '@openagentry/core';
import { defineCommand } from '../command.js';
import { writeWorkspaceConfig } from '../config/workspace.js';
import type { WorkspaceConfig } from '../config/schema.js';

export const initCommand = defineCommand({
  name: 'init',
  summary: 'Create .agentry/workspace.json in the current directory.',
  async run(args, output, ctx) {
    const cfgPath = join(ctx.cwd, '.agentry', 'workspace.json');
    const force = args.flags['force'] === true || args.flags['force'] === 'true';

    let exists = false;
    try {
      const s = await stat(cfgPath);
      exists = s.isFile();
    } catch {
      // ENOENT or similar — treat as "doesn't exist".
    }

    if (exists && !force) {
      throw new AgentryError({
        code: 'E_WORKSPACE_EXISTS',
        message: `${cfgPath} already exists. Use --force to overwrite.`,
        phase: 'init',
        suggestedFix: `agentry init --force`,
        context: { path: cfgPath },
      });
    }

    const cfg: WorkspaceConfig = {
      plugins: args.positional,
      defaultEnv: 'dev',
    };
    await writeWorkspaceConfig(ctx.cwd, cfg);

    output.text(`Created ${cfgPath}`);
    if (cfg.plugins.length > 0) {
      output.text('Plugins:');
      for (const p of cfg.plugins) output.text(`  - ${p}`);
    } else {
      output.text('No plugins configured. Add some with `agentry init <pkg> [<pkg>...] --force`.');
    }
    output.json({
      workspaceRoot: ctx.cwd,
      configPath: cfgPath,
      created: true,
      plugins: cfg.plugins,
      defaultEnv: cfg.defaultEnv,
    });
    return 0;
  },
});
