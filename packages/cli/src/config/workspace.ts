/**
 * Read/write `<workspace>/.agentry/workspace.json` and resolve the workspace
 * root by walking upward from a starting directory.
 *
 * @module
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { AgentryError } from '@openagentry/core';
import { workspaceConfigSchema, type WorkspaceConfig } from './schema.js';

export function defaultWorkspaceConfig(): WorkspaceConfig {
  return { plugins: [] };
}

function workspaceConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.agentry', 'workspace.json');
}

export async function readWorkspaceConfig(workspaceRoot: string): Promise<WorkspaceConfig> {
  const path = workspaceConfigPath(workspaceRoot);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultWorkspaceConfig();
    }
    throw new AgentryError({
      code: 'E_WORKSPACE_CONFIG_READ',
      message: `Cannot read ${path}: ${(err as Error).message}`,
      phase: 'init',
      cause: err,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AgentryError({
      code: 'E_WORKSPACE_CONFIG_INVALID',
      message: `${path} is not valid JSON: ${(err as Error).message}`,
      phase: 'validate',
      cause: err,
    });
  }

  const result = workspaceConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new AgentryError({
      code: 'E_WORKSPACE_CONFIG_INVALID',
      message: `${path} failed schema validation: ${result.error.message}`,
      phase: 'validate',
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}

export async function writeWorkspaceConfig(
  workspaceRoot: string,
  cfg: WorkspaceConfig,
): Promise<void> {
  const path = workspaceConfigPath(workspaceRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

/**
 * Walk upward from `startDir` looking for `.agentry/workspace.json`. Returns
 * the directory containing it, or `undefined` if none found before filesystem
 * root.
 */
export async function locateWorkspaceRoot(startDir: string): Promise<string | undefined> {
  const { root } = parse(startDir);
  let cursor = startDir;
  while (true) {
    try {
      const s = await stat(join(cursor, '.agentry', 'workspace.json'));
      if (s.isFile()) return cursor;
    } catch {
      // not present; continue
    }
    if (cursor === root) return undefined;
    cursor = dirname(cursor);
  }
}
